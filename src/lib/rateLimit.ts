/**
 * In-memory sliding-window rate limiter for payment operations.
 *
 * Uses a Map keyed by identity (wallet address or IP fallback) to track
 * request timestamps within a rolling window. Requests older than the
 * window are pruned on each check so memory stays bounded.
 *
 * Limits are intentionally generous for legitimate use while blocking
 * automated abuse. The whitelist allows bypass for known safe identities
 * (e.g., integration test runners, internal service accounts).
 */

export interface RateLimitConfig {
  /** Rolling window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix ms timestamp when the window resets. */
  resetAt: number;
  /** Seconds until the window resets (for Retry-After header). */
  retryAfterSeconds: number;
}

// Payment-specific limits (per wallet address or IP).
export const PAYMENT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1-minute window
  maxRequests: 10,        // 10 payment attempts per minute
};

// Lighter limit for read operations like invoice fetches.
export const QUERY_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 120,
};

const store = new Map<string, number[]>();

// Identities that are always allowed through (integration tests, admin).
const WHITELIST = new Set<string>(
  (process.env.RATE_LIMIT_WHITELIST ?? '').split(',').map((s) => s.trim()).filter(Boolean)
);

/**
 * Check whether `identity` is within the rate limit and record this attempt.
 *
 * @param identity - Wallet address, user ID, or IP to bucket requests by.
 * @param config   - Window and limit configuration.
 */
export function checkRateLimit(identity: string, config: RateLimitConfig): RateLimitResult {
  if (WHITELIST.has(identity)) {
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create the timestamp list for this identity.
  const timestamps = (store.get(identity) ?? []).filter((t) => t > windowStart);

  const allowed = timestamps.length < config.maxRequests;
  if (allowed) {
    timestamps.push(now);
  }
  store.set(identity, timestamps);

  const resetAt = (timestamps[0] ?? now) + config.windowMs;
  const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - timestamps.length),
    resetAt,
    retryAfterSeconds,
  };
}

/**
 * Extract the best available identity for rate limiting from a request.
 * Prefers the X-Wallet-Address header (set by the frontend after wallet connect),
 * then falls back to X-Forwarded-For / remote IP.
 */
export function getRequestIdentity(request: Request): string {
  // Wallet address is the most precise identity — one wallet = one limit bucket.
  const wallet = (request.headers as Headers).get('x-wallet-address');
  if (wallet && /^G[A-Z0-9]{55}$/.test(wallet)) return wallet;

  // Fall back to IP-based limiting.
  const forwarded = (request.headers as Headers).get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();

  return 'unknown';
}

/**
 * Prune stale entries periodically to prevent unbounded memory growth.
 * Safe to call in a background interval.
 */
export function pruneRateLimitStore(): void {
  const now = Date.now();
  // Use the maximum window across all configs (1 minute) as the prune threshold.
  const threshold = Math.max(PAYMENT_RATE_LIMIT.windowMs, QUERY_RATE_LIMIT.windowMs);
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > now - threshold);
    if (fresh.length === 0) {
      store.delete(key);
    } else {
      store.set(key, fresh);
    }
  }
}
