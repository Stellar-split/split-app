/**
 * Central fetch wrapper that intercepts 429 (Too Many Requests) responses,
 * reads the Retry-After header, and schedules an automatic retry.
 *
 * Consumers call `apiFetch` instead of raw `fetch`. When a 429 is received:
 *  - The global RateLimitContext is notified so the banner renders a countdown.
 *  - The request is queued and retried automatically after the delay.
 *  - Only one pending rate-limit state is tracked at a time; concurrent 429s
 *    do not duplicate the banner.
 */

type RateLimitListener = (retryAt: number | null) => void;

const listeners = new Set<RateLimitListener>();
let currentRetryAt: number | null = null;

/** Subscribe to rate-limit state changes (used by RateLimitContext). */
export function subscribeRateLimit(fn: RateLimitListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Read the current retryAt timestamp (ms epoch), or null if not rate-limited. */
export function getCurrentRateLimitRetryAt(): number | null {
  return currentRetryAt;
}

function notify(retryAt: number | null) {
  currentRetryAt = retryAt;
  listeners.forEach((fn) => fn(retryAt));
}

/**
 * Parse the Retry-After header value (seconds or HTTP-date) into milliseconds
 * from now. Falls back to 60 s if the header is absent or unparseable.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return 60_000;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1_000;
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  return 60_000;
}

/**
 * `apiFetch` is a drop-in replacement for `fetch` that adds transparent
 * 429-retry with countdown notification.
 *
 * - Retries the request **once** after the Retry-After delay.
 * - Resolves the original Promise as if the first call had succeeded.
 * - Multiple concurrent 429s share one countdown; the banner stays single.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 429) return response;

  const delayMs = parseRetryAfter(response.headers.get("Retry-After"));
  const retryAt = Date.now() + delayMs;

  // Only update state if no countdown is already running or this one is later.
  if (currentRetryAt === null || retryAt > currentRetryAt) {
    notify(retryAt);
  }

  // Wait for the retry window, then re-issue the request.
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  // Clear rate-limit state after retry fires.
  notify(null);

  return fetch(input, init);
}
