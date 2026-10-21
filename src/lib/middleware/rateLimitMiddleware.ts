import { NextResponse } from 'next/server';
import { checkRateLimit, getRequestIdentity, type RateLimitConfig } from '@/lib/rateLimit';

/**
 * Apply server-side rate limiting to a route handler.
 *
 * Returns a 429 NextResponse with standard headers when the limit is exceeded,
 * otherwise returns null so the caller can proceed.
 *
 * Standard rate-limit response headers are set on BOTH the 429 and on passed
 * requests (via the returned headers object) so clients can track their budget.
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig
): { limited: true; response: NextResponse } | { limited: false; headers: Record<string, string> } {
  const identity = getRequestIdentity(request);
  const result = checkRateLimit(identity, config);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: 'Too many requests. Please wait before retrying.',
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(result.retryAfterSeconds));
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return { limited: true, response };
  }

  return { limited: false, headers };
}
