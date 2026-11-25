import { z } from 'zod';

/**
 * Currency service for multi-currency invoice support.
 *
 * Responsibilities:
 *  - Fetch exchange rates from the rate API
 *  - Cache rates with a TTL
 *  - Provide conversion helpers (to/from XLM)
 *  - Capture and validate rate locks with expiry
 *  - Persist per-invoice currency history snapshots
 *
 * Pure functions are exported separately so they can be unit-tested
 * without any network or storage dependencies.
 */

// ---------------------------------------------------------------------------
// Types & schemas
// ---------------------------------------------------------------------------

export interface ExchangeRates {
  /** Base currency these rates are expressed against (always XLM). */
  base: 'XLM';
  /** Map of ISO currency code -> units of that currency per 1 XLM. */
  rates: Record<string, number>;
  /** ISO timestamp when the rates were fetched. */
  fetchedAt: string;
}

export interface RateLock {
  invoiceId: string;
  currency: string;
  /** Units of `currency` per 1 XLM at lock time. */
  rate: number;
  /** ISO timestamp when the lock was created. */
  lockedAt: string;
  /** ISO timestamp when the lock expires. */
  expiresAt: string;
}

export interface CurrencyHistoryEntry {
  invoiceId: string;
  currency: string;
  rate: number;
  amount: number;
  amountXlm: number;
  recordedAt: string;
  /** Optional reason for the snapshot (e.g. "created", "payment", "rate-lock"). */
  reason?: string;
}

const exchangeRatesSchema = z.object({
  base: z.literal('XLM'),
  rates: z.record(z.string(), z.number().positive()),
  fetchedAt: z.string(),
});

const rateLockSchema = z.object({
  invoiceId: z.string().min(1),
  currency: z.string().min(1),
  rate: z.number().positive(),
  lockedAt: z.string(),
  expiresAt: z.string(),
});

const currencyHistoryEntrySchema = z.object({
  invoiceId: z.string().min(1),
  currency: z.string().min(1),
  rate: z.number().positive(),
  amount: z.number().nonnegative(),
  amountXlm: z.number().nonnegative(),
  recordedAt: z.string(),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_RATE_API_URL =
  'https://api.example.com/v1/exchange-rates?base=XLM';

/** Default cache TTL for exchange rates (60 seconds). */
export const DEFAULT_RATE_CACHE_TTL_MS = 60_000;

/** Default duration for which a rate lock remains valid (5 minutes). */
export const DEFAULT_RATE_LOCK_TTL_MS = 5 * 60_000;

const STORAGE_KEYS = {
  rateCache: 'currency:rate-cache',
  rateLocks: 'currency:rate-locks',
  history: 'currency:history',
} as const;

function getRateApiUrl(): string {
  // Allow override via Vite/Next-style env vars without hard dependency.
  const env =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string> }).env) ||
    (typeof process !== 'undefined' ? process.env : undefined);
  return env?.VITE_RATE_API_URL || env?.RATE_API_URL || DEFAULT_RATE_API_URL;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------

/**
 * Convert an amount in `currency` to XLM using the given rate
 * (units of `currency` per 1 XLM).
 */
export function convertToXlm(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative finite number');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be a positive finite number');
  }
  return amount / rate;
}

/**
 * Convert an amount in XLM to `currency` using the given rate
 * (units of `currency` per 1 XLM).
 */
export function convertFromXlm(amountXlm: number, rate: number): number {
  if (!Number.isFinite(amountXlm) || amountXlm < 0) {
    throw new Error('XLM amount must be a non-negative finite number');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be a positive finite number');
  }
  return amountXlm * rate;
}

/**
 * Round a numeric amount to a fixed number of decimal places.
 * Useful for display and for stable comparisons.
 */
export function roundAmount(value: number, decimals = 7): number {
  if (!Number.isFinite(value)) {
    throw new Error('Value must be a finite number');
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Determine whether a rate lock is still valid at a given time.
 * Pure function so it can be tested without touching the clock.
 */
export function isRateLockValid(lock: RateLock, now: Date = new Date()): boolean {
  const expiresAt = Date.parse(lock.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return now.getTime() < expiresAt;
}

/**
 * Build a rate lock object. Pure function.
 */
export function createRateLock(
  invoiceId: string,
  currency: string,
  rate: number,
  now: Date = new Date(),
  ttlMs: number = DEFAULT_RATE_LOCK_TTL_MS,
): RateLock {
  if (!invoiceId) throw new Error('invoiceId is required');
  if (!currency) throw new Error('currency is required');
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be a positive finite number');
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('ttlMs must be a positive finite number');
  }
  return {
    invoiceId,
    currency,
    rate,
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Storage abstraction (localStorage with in-memory fallback)
// ---------------------------------------------------------------------------

interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memoryStore = new Map<string, string>();

const store: KeyValueStore = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        get: (key) => localStorage.getItem(key),
        set: (key, value) => localStorage.setItem(key, value),
        remove: (key) => localStorage.removeItem(key),
      };
    }
  } catch {
    // Fall through to memory store (e.g. SSR or privacy mode).
  }
  return {
    get: (key) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
    set: (key, value) => {
      memoryStore.set(key, value);
    },
    remove: (key) => {
      memoryStore.delete(key);
    },
  };
})();

function readJson<T>(key: string): T | null {
  const raw = store.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    store.set(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / serialization errors.
  }
}

// ---------------------------------------------------------------------------
// Rate cache
// ---------------------------------------------------------------------------

interface RateCacheEntry {
  rates: ExchangeRates;
  cachedAt: number;
}

let inMemoryCache: RateCacheEntry | null = null;
let inflightFetch: Promise<ExchangeRates> | null = null;

function loadCache(): RateCacheEntry | null {
  if (inMemoryCache) return inMemoryCache;
  const stored = readJson<RateCacheEntry>(STORAGE_KEYS.rateCache);
  if (stored && stored.rates && typeof stored.cachedAt === 'number') {
    inMemoryCache = stored;
    return stored;
  }
  return null;
}

function saveCache(entry: RateCacheEntry): void {
  inMemoryCache = entry;
  writeJson(STORAGE_KEYS.rateCache, entry);
}

function isCacheFresh(entry: RateCacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.cachedAt < ttlMs;
}

/**
 * Fetch exchange rates from the API. Throws on network or schema errors.
 */
async function fetchRatesFromApi(): Promise<ExchangeRates> {
  const response = await fetch(getRateApiUrl(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Rate API responded with ${response.status}`);
  }
  const json = await response.json();
  const parsed = exchangeRatesSchema.parse({
    base: 'XLM',
    rates: json.rates ?? json.data?.rates ?? {},
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
  });
  return parsed;
}

/**
 * Get current exchange rates, using the cache when fresh.
 *
 * @param options.force - bypass the cache and fetch fresh rates.
 * @param options.ttlMs - override the cache TTL.
 */
export async function getExchangeRates(options?: {
  force?: boolean;
  ttlMs?: number;
}): Promise<ExchangeRates> {
  const ttlMs = options?.ttlMs ?? DEFAULT_RATE_CACHE_TTL_MS;
  const cached = loadCache();

  if (!options?.force && cached && isCacheFresh(cached, ttlMs)) {
    return cached.rates;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    try {
      const rates = await fetchRatesFromApi();
      saveCache({ rates, cachedAt: Date.now() });
      return rates;
    } catch (error) {
      // Serve stale cache if available rather than failing hard.
      if (cached) {
        return cached.rates;
      }
      throw error;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

/**
 * Clear the cached exchange rates.
 */
export function clearRateCache(): void {
  inMemoryCache = null;
  store.remove(STORAGE_KEYS.rateCache);
}

// ---------------------------------------------------------------------------
// Conversion helpers (async, rate-aware)
// ---------------------------------------------------------------------------

async function resolveRate(currency: string): Promise<number> {
  const rates = await getExchangeRates();
  const rate = rates.rates[currency.toUpperCase()];
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No exchange rate available for currency ${currency}`);
  }
  return rate;
}

/**
 * Convert an amount in `currency` to XLM using current rates.
 */
export async function convertToXlmAsync(
  amount: number,
  currency: string,
): Promise<number> {
  const rate = await resolveRate(currency);
  return convertToXlm(amount, rate);
}

/**
 * Convert an amount in XLM to `currency` using current rates.
 */
export async function convertFromXlmAsync(
  amountXlm: number,
  currency: string,
): Promise<number> {
  const rate = await resolveRate(currency);
  return convertFromXlm(amountXlm, rate);
}

// ---------------------------------------------------------------------------
// Rate locks
// ---------------------------------------------------------------------------

type RateLockMap = Record<string, RateLock>;

function loadRateLocks(): RateLockMap {
  return readJson<RateLockMap>(STORAGE_KEYS.rateLocks) ?? {};
}

function saveRateLocks(locks: RateLockMap): void {
  writeJson(STORAGE_KEYS.rateLocks, locks);
}

/**
 * Capture a rate lock for an invoice at the current market rate.
 */
export async function lockRate(
  invoiceId: string,
  currency: string,
  ttlMs: number = DEFAULT_RATE_LOCK_TTL_MS,
): Promise<RateLock> {
  const rate = await resolveRate(currency);
  const lock = createRateLock(invoiceId, currency.toUpperCase(), rate, new Date(), ttlMs);
  const locks = loadRateLocks();
  locks[invoiceId] = lock;
  saveRateLocks(locks);
  return lock;
}

/**
 * Retrieve a stored rate lock for an invoice, if any.
 */
export function getRateLock(invoiceId: string): RateLock | null {
  const locks = loadRateLocks();
  const lock = locks[invoiceId];
  if (!lock) return null;
  const parsed = rateLockSchema.safeParse(lock);
  return parsed.success ? parsed.data : null;
}

/**
 * Retrieve a rate lock only if it is still valid.
 */
export function getValidRateLock(
  invoiceId: string,
  now: Date = new Date(),
): RateLock | null {
  const lock = getRateLock(invoiceId);
  if (!lock) return null;
  return isRateLockValid(lock, now) ? lock : null;
}

/**
 * Remove a rate lock for an invoice.
 */
export function clearRateLock(invoiceId: string): void {
  const locks = loadRateLocks();
  if (locks[invoiceId]) {
    delete locks[invoiceId];
    saveRateLocks(locks);
  }
}

/**
 * Resolve the effective rate for a payment: prefer a valid lock,
 * otherwise fall back to the current market rate.
 */
export async function resolvePaymentRate(
  invoiceId: string,
  currency: string,
  now: Date = new Date(),
): Promise<{ rate: number; locked: boolean; lock: RateLock | null }> {
  const lock = getValidRateLock(invoiceId, now);
  if (lock && lock.currency === currency.toUpperCase()) {
    return { rate: lock.rate, locked: true, lock };
  }
  const rate = await resolveRate(currency);
  return { rate, locked: false, lock: null };
}

// ---------------------------------------------------------------------------
// Currency history
// ---------------------------------------------------------------------------

type HistoryMap = Record<string, CurrencyHistoryEntry[]>;

function loadHistory(): HistoryMap {
  return readJson<HistoryMap>(STORAGE_KEYS.history) ?? {};
}

function saveHistory(history: HistoryMap): void {
  writeJson(STORAGE_KEYS.history, history);
}

/**
 * Record a currency snapshot for an invoice.
 */
export function recordCurrencyHistory(
  entry: Omit<CurrencyHistoryEntry, 'recordedAt'> & { recordedAt?: string },
): CurrencyHistoryEntry {
  const full: CurrencyHistoryEntry = {
    ...entry,
    currency: entry.currency.toUpperCase(),
    recordedAt: entry.recordedAt ?? new Date().toISOString(),
  };
  const parsed = currencyHistoryEntrySchema.parse(full);
  const history = loadHistory();
  const list = history[parsed.invoiceId] ?? [];
  list.push(parsed);
  history[parsed.invoiceId] = list;
  saveHistory(history);
  return parsed;
}

/**
 * Get the currency history for an invoice, oldest first.
 */
export function getCurrencyHistory(invoiceId: string): CurrencyHistoryEntry[] {
  const history = loadHistory();
  const list = history[invoiceId] ?? [];
  return list
    .map((entry) => currencyHistoryEntrySchema.safeParse(entry))
    .filter((r): r is { success: true; data: CurrencyHistoryEntry } => r.success)
    .map((r) => r.data);
}

/**
 * Clear the currency history for an invoice.
 */
export function clearCurrencyHistory(invoiceId: string): void {
  const history = loadHistory();
  if (history[invoiceId]) {
    delete history[invoiceId];
    saveHistory(history);
  }
}

// ---------------------------------------------------------------------------
// Convenience: create a snapshot for an invoice in one call
// ---------------------------------------------------------------------------

/**
 * Record a currency snapshot for an invoice using the current (or locked) rate.
 */
export async function snapshotInvoiceCurrency(
  invoiceId: string,
  currency: string,
  amount: number,
  reason?: string,
): Promise<CurrencyHistoryEntry> {
  const { rate } = await resolvePaymentRate(invoiceId, currency);
  const amountXlm = convertToXlm(amount, rate);
  return recordCurrencyHistory({
    invoiceId,
    currency,
    rate,
    amount,
    amountXlm,
    reason,
  });
}