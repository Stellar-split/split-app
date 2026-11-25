/**
 * Privacy-preserving analytics module.
 *
 * - All tracking is gated behind explicit user consent (persisted in localStorage).
 * - Events are batched and flushed asynchronously (sendBeacon / fetch keepalive)
 *   so tracking never blocks the UI.
 * - PII (emails, addresses) is stripped from event payloads before sending.
 */

export type AnalyticsEventName =
  | 'app_opened'
  | 'page_view'
  | 'wallet_connected'
  | 'wallet_disconnected'
  | 'transaction_initiated'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'search_performed'
  | 'filter_applied'
  | 'settings_changed'
  | 'feature_used'
  | 'error_occurred'
  | 'invoice_list_viewed'
  | 'invoice_created';

export interface AnalyticsProperties {
  /** Arbitrary string properties. PII is stripped before sending. */
  [key: string]: string | number | boolean | null | undefined | Record<string, number>;
}

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties: AnalyticsProperties;
  timestamp: number;
}

export type ConsentStatus = 'granted' | 'denied' | 'unset';

const CONSENT_STORAGE_KEY = 'analytics_consent';
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE_SIZE = 200;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Matches typical street addresses (number followed by words and a street suffix).
const ADDRESS_REGEX =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|ter|circle|cir|highway|hwy|parkway|pkwy)\b\.?/gi;
// Matches common crypto wallet addresses (EVM + Solana-like base58).
const WALLET_REGEX = /\b(?:0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let endpoint = '/api/analytics/events';
let globalProperties: AnalyticsProperties = {};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode, quota); fail silently.
  }
}

/**
 * Returns the current consent status. Defaults to 'unset' when no decision
 * has been recorded.
 */
export function getConsent(): ConsentStatus {
  if (!isBrowser()) {
    return 'unset';
  }
  const stored = safeGetItem(CONSENT_STORAGE_KEY);
  if (stored === 'granted' || stored === 'denied') {
    return stored;
  }
  return 'unset';
}

/**
 * Records the user's consent decision. When consent is revoked, any queued
 * events are discarded and the flush timer is stopped.
 */
export function setConsent(status: 'granted' | 'denied'): void {
  if (!isBrowser()) {
    return;
  }
  safeSetItem(CONSENT_STORAGE_KEY, status);

  if (status === 'denied') {
    queue = [];
    stopFlushTimer();
  } else if (status === 'granted' && initialized) {
    startFlushTimer();
  }
}

function hasConsent(): boolean {
  return getConsent() === 'granted';
}

/**
 * Removes PII (emails, addresses, wallet addresses) from a string value.
 */
function stripPiiFromString(value: string): string {
  return value
    .replace(EMAIL_REGEX, '[redacted-email]')
    .replace(ADDRESS_REGEX, '[redacted-address]')
    .replace(WALLET_REGEX, '[redacted-wallet]');
}

/**
 * Recursively sanitizes a property value, stripping PII from strings.
 */
function sanitizeValue(value: unknown): string | number | boolean | null | undefined {
  if (typeof value === 'string') {
    return stripPiiFromString(value);
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  // Drop non-primitive values to avoid leaking unexpected data.
  return undefined;
}

function sanitizeProperties(properties: AnalyticsProperties): AnalyticsProperties {
  const sanitized: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    const cleanValue = sanitizeValue(value);
    if (cleanValue !== undefined) {
      sanitized[key] = cleanValue;
    }
  }
  return sanitized;
}

function startFlushTimer(): void {
  if (flushTimer !== null || !isBrowser()) {
    return;
  }
  flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
}

function stopFlushTimer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Sends a batch of events without blocking the UI. Prefers sendBeacon and
 * falls back to fetch with keepalive.
 */
function sendBatch(events: AnalyticsEvent[]): void {
  if (events.length === 0 || !isBrowser()) {
    return;
  }

  const payload = JSON.stringify({ events });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) {
        return;
      }
    }
  } catch {
    // Fall through to fetch.
  }

  try {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Network failures are non-fatal for analytics.
    });
  } catch {
    // Ignore; analytics must never throw into app code.
  }
}

/**
 * Flushes all queued events. Safe to call at any time; no-op without consent.
 */
export async function flush(): Promise<void> {
  if (!hasConsent() || queue.length === 0) {
    return;
  }
  const batch = queue;
  queue = [];
  sendBatch(batch);
}

/**
 * Initializes the analytics module. Idempotent.
 *
 * @param options.endpoint - Custom ingestion endpoint.
 * @param options.properties - Global custom properties attached to every event.
 */
export function initAnalytics(options?: {
  endpoint?: string;
  properties?: AnalyticsProperties;
}): void {
  if (!isBrowser()) {
    return;
  }
  if (options?.endpoint) {
    endpoint = options.endpoint;
  }
  if (options?.properties) {
    globalProperties = { ...globalProperties, ...sanitizeProperties(options.properties) };
  }

  if (initialized) {
    return;
  }
  initialized = true;

  if (hasConsent()) {
    startFlushTimer();
  }

  // Flush remaining events when the page is being hidden/unloaded.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flush();
    }
  });
  window.addEventListener('pagehide', () => {
    void flush();
  });
}

/**
 * Tracks a user action. No-op unless the user has granted consent.
 * Events are queued and flushed asynchronously in batches.
 */
export function trackEvent(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (!isBrowser() || !hasConsent()) {
    return;
  }

  const event: AnalyticsEvent = {
    name,
    properties: sanitizeProperties({ ...globalProperties, ...properties }),
    timestamp: Date.now(),
  };

  queue.push(event);

  // Bound memory usage if flushing is failing or slow.
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }

  if (queue.length >= BATCH_SIZE) {
    void flush();
  }
}