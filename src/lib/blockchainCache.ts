/**
 * Small in-memory TTL cache for blockchain reads (Horizon/RPC queries), used
 * to cut down on redundant network calls for data that doesn't change on
 * every request (e.g. invoice lookups, path-payment quotes).
 *
 * Deliberately process-local and not shared across serverless instances —
 * this is a request-rate dampener, not a source of truth. The network is
 * always consulted again once an entry expires or is evicted.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

export interface BlockchainCacheStats {
  hits: number;
  misses: number;
  /** Entries evicted to stay under maxEntries, not expirations. */
  evictions: number;
  size: number;
  hitRate: number;
}

/** Per-data-type TTL in milliseconds. Tuned to how often each kind changes. */
export const CACHE_TTL = {
  /** On-chain invoice record. Rarely changes once created; short TTL is just
   * enough to collapse bursts of re-renders/polling onto one RPC call. */
  invoice: 15_000,
  /** XLM->USDC path-payment quote. Prices move, so this is kept very short. */
  quote: 5_000,
  /** Contract/account metadata that essentially never changes post-deploy. */
  staticMeta: 5 * 60_000,
  /** USDC token balance for a wallet. Polled from multiple components
   * (WalletConnect header, PayModal) on connect/mount; short TTL collapses
   * those into one RPC simulation without serving noticeably stale data. */
  balance: 10_000,
} as const;

export type CacheKind = keyof typeof CACHE_TTL;

class BlockchainCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  /** Bounds memory use; oldest entry is evicted first (Map preserves insertion order). */
  private readonly maxEntries = 500;

  private key(kind: CacheKind, id: string): string {
    return `${kind}:${id}`;
  }

  get<T>(kind: CacheKind, id: string): T | undefined {
    const entry = this.store.get(this.key(kind, id)) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(kind, id));
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  set<T>(kind: CacheKind, id: string, value: T, ttlMs: number = CACHE_TTL[kind]): void {
    const key = this.key(kind, id);
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions++;
      }
    }
    const now = Date.now();
    this.store.set(key, { value, expiresAt: now + ttlMs, cachedAt: now });
  }

  /**
   * Fetch-through helper: returns the cached value if still fresh, otherwise
   * calls `fetcher`, caches the result, and returns it. Failed fetches are
   * not cached, so a transient RPC error doesn't get served as stale data
   * (and isn't "stale data served" per se, since nothing is stored).
   */
  async getOrFetch<T>(
    kind: CacheKind,
    id: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(kind, id);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(kind, id, value, ttlMs);
    return value;
  }

  /** Drops one entry, e.g. after a mutation that invalidates it. */
  invalidate(kind: CacheKind, id: string): void {
    this.store.delete(this.key(kind, id));
  }

  /** Drops every entry of a given kind, e.g. after a bulk-affecting action. */
  invalidateKind(kind: CacheKind): void {
    const prefix = `${kind}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  stats(): BlockchainCacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.store.size,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

/** Process-wide singleton — one cache per server instance / browser tab. */
export const blockchainCache = new BlockchainCache();
