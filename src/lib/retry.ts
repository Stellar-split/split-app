export interface RetryAttemptInfo {
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  maxAttempts?: number;
  retryAfterMs?: number;
  onRetry?: (info: RetryAttemptInfo) => void;
  shouldRetry?: (error: unknown) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: number | RetryOptions
): Promise<T> {
  let opts: RetryOptions = {};
  if (typeof options === 'number') {
    opts = { maxAttempts: options };
  } else {
    opts = options ?? {};
  }

  const maxAttempts = opts.maxAttempts ?? 3;
  const retryAfterMs = opts.retryAfterMs ?? 0;
  const onRetry = opts.onRetry;
  const shouldRetry = opts.shouldRetry;

  let lastError: unknown;
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry || shouldRetry(error)) {
        if (attempt < maxAttempts) {
          const nextDelayMs = retryAfterMs || delayMs * Math.pow(2, attempt - 1);
          onRetry?.({
            attempt,
            delayMs: nextDelayMs,
            error,
          });
          await new Promise(resolve => setTimeout(resolve, nextDelayMs));
        }
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

export function parseRetryAfter(header?: string | null): number {
  if (!header) return 0;
  const seconds = parseInt(header, 10);
  return isNaN(seconds) ? 0 : seconds * 1000;
}

export function recordRetryMetric(name: string, attempt?: number): void {
  // No-op stub
}
