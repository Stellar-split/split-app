/**
 * Central fetch wrapper that intercepts 429 (Too Many Requests) responses,
 * reads the Retry-After header, and schedules an automatic retry.
 *
 * Consumers call `apiFetch` instead of raw `fetch`. When a 429 is received:
 *  - The global RateLimitContext is notified so the banner renders a countdown.
 *  - The request is retried with exponential backoff (honoring Retry-After).
 *  - Only one pending rate-limit state is tracked at a time; concurrent 429s
 *    do not duplicate the banner.
 *  - If all retries are exhausted, an AppError is thrown and retry metrics
 *    are recorded.
 */

import { AppError } from "./appError";
import {
  retryWithBackoff,
  parseRetryAfter,
  recordRetryMetric,
  type RetryAttemptInfo,
} from "./retry";

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

/** Maximum number of retry attempts for rate-limited requests. */
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * `apiFetch` is a drop-in replacement for `fetch` that adds transparent
 * 429-retry with exponential backoff and countdown notification.
 *
 * - Retries the request up to MAX_RATE_LIMIT_RETRIES times, honoring the
 *   Retry-After header when present and falling back to exponential backoff
 *   with jitter otherwise.
 * - Resolves the original Promise as if the first call had succeeded.
 * - Multiple concurrent 429s share one countdown; the banner stays single.
 * - Throws an AppError if all retries are exhausted.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 429) return response;

  const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));

  // Notify the banner of the initial rate-limit window.
  const initialRetryAt = Date.now() + retryAfterMs;
  if (currentRetryAt === null || initialRetryAt > currentRetryAt) {
    notify(initialRetryAt);
  }

  try {
    return await retryWithBackoff(
      async () => {
        const res = await fetch(input, init);
        if (res.status === 429) {
          const err = new AppError("RATE_LIMITED", "Too many requests", {
            status: 429,
            retryAfterMs: parseRetryAfter(res.headers.get("Retry-After")),
          });
          throw err;
        }
        return res;
      },
      {
        maxAttempts: MAX_RATE_LIMIT_RETRIES,
        retryAfterMs,
        onRetry: (info: RetryAttemptInfo) => {
          const retryAt = Date.now() + info.delayMs;
          if (currentRetryAt === null || retryAt > currentRetryAt) {
            notify(retryAt);
          }
        },
        shouldRetry: (err: unknown) =>
          err instanceof AppError && err.code === "RATE_LIMITED",
      }
    );
  } catch (err) {
    recordRetryMetric("rate_limit_exhausted");
    throw new AppError(
      "RATE_LIMIT_EXHAUSTED",
      "The server is busy. Please try again in a moment.",
      { cause: err, retryAfterMs }
    );
  } finally {
    // Clear rate-limit state after retries complete.
    notify(null);
  }
}
