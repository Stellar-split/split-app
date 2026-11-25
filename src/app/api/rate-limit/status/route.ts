import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIdentity, PAYMENT_RATE_LIMIT } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** GET /api/rate-limit/status — returns current rate limit state for the caller. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = getRequestIdentity(request);
  // Peek at current state without recording an attempt (pass a copy with maxRequests+1 to avoid side effects).
  const result = checkRateLimit(identity, { ...PAYMENT_RATE_LIMIT, maxRequests: PAYMENT_RATE_LIMIT.maxRequests + 1 });
  return NextResponse.json({
    limit: PAYMENT_RATE_LIMIT.maxRequests,
    remaining: Math.min(result.remaining, PAYMENT_RATE_LIMIT.maxRequests),
    resetAt: result.resetAt,
    windowMs: PAYMENT_RATE_LIMIT.windowMs,
  });
}
