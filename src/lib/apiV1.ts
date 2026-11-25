import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken } from "@/lib/apiKeys";
import { verifySignedApiKey } from "@/lib/signedApiKeys";

export const API_VERSION = "v1";
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface ApiRequestContext {
  requestId: string;
  remaining: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, Bucket>();

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]),
    );
  }
  return value;
}

function clientIdentifier(request: NextRequest, token: string | null): string {
  if (token) return createHash("sha256").update(token).digest("hex");
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function rateLimit(key: string): Bucket & { allowed: boolean; remaining: number } {
  const now = Date.now();
  for (const [bucketKey, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) rateLimitBuckets.delete(bucketKey);
  }

  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    const fresh = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateLimitBuckets.set(key, fresh);
    return { ...fresh, allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (bucket.count >= RATE_LIMIT) {
    return { ...bucket, allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { ...bucket, allowed: true, remaining: RATE_LIMIT - bucket.count };
}

function responseHeaders(context: ApiRequestContext): HeadersInit {
  return {
    "X-API-Version": API_VERSION,
    "X-Request-Id": context.requestId,
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(context.remaining),
    "X-RateLimit-Reset": String(Math.ceil(context.resetAt / 1000)),
    "Cache-Control": "no-store",
  };
}

export function prepareApiRequest(request: NextRequest): ApiRequestContext | NextResponse {
  const requestId = randomUUID();
  const token = extractBearerToken(request.headers.get("authorization"));
  const bucket = rateLimit(clientIdentifier(request, token));
  const context = { requestId, remaining: bucket.remaining, resetAt: bucket.resetAt };

  if (!bucket.allowed) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    const response = apiError(
      429,
      "RATE_LIMITED",
      "Too many requests. Retry after the rate limit window resets.",
      context,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  if (process.env.NODE_ENV === "production" && !process.env.API_KEY_SIGNING_SECRET) {
    return apiError(
      503,
      "CONFIGURATION_ERROR",
      "API key authentication is not configured.",
      context,
    );
  }

  if (!token || !verifySignedApiKey(token)) {
    return apiError(401, "UNAUTHORIZED", "A valid API key is required.", context);
  }

  return context;
}

export function isApiResponse(value: ApiRequestContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function apiSuccess(
  data: unknown,
  context: ApiRequestContext,
  status = 200,
): NextResponse {
  return NextResponse.json(
    {
      data: toJsonSafe(data),
      meta: { apiVersion: API_VERSION, requestId: context.requestId },
    },
    { status, headers: responseHeaders(context) },
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  context: ApiRequestContext,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details: toJsonSafe(details) }),
        requestId: context.requestId,
      },
      meta: { apiVersion: API_VERSION, requestId: context.requestId },
    },
    { status, headers: responseHeaders(context) },
  );
}