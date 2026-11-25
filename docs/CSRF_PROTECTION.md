# CSRF Protection

## Overview

StellarSplit implements double-submit CSRF protection using HMAC-signed tokens.
All state-changing API requests (POST, PUT, PATCH, DELETE) must carry a valid
`X-CSRF-Token` header or the server returns `403 Forbidden`.

## How It Works

1. The client fetches a token from `GET /api/csrf`
2. The server generates `nonce.expiresAt`, signs it with `HMAC-SHA256` using
   `CSRF_SECRET`, and returns `${nonce}.${expiresAt}.${signature}`
3. The token is cached client-side and refreshed 1 minute before expiry (60-minute TTL)
4. Every mutating request automatically includes `X-CSRF-Token: <token>` via
   the centralised `apiFetch` wrapper in `src/lib/apiClient.ts`
5. Route handlers call `assertCsrf(request)` which validates the HMAC signature
   and checks the expiry timestamp

## Implementation Files

| File | Role |
|------|------|
| `src/lib/csrf.ts` | Token generation (`generateCsrfToken`) and validation (`isValidCsrfToken`) |
| `src/app/api/csrf/route.ts` | `GET /api/csrf` — token issuance endpoint |
| `src/lib/apiClient.ts` | Client-side fetch wrapper — injects header automatically on mutations |
| `src/lib/middleware/csrfMiddleware.ts` | `assertCsrf(request)` guard helper for route handlers |
| `src/hooks/useCsrfToken.ts` | React hook for explicit token access in components |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CSRF_SECRET` | **Required in production.** A random 32+ byte string used to sign tokens. Generate with: `openssl rand -hex 32` |

> In development (`NODE_ENV !== 'production'`), a fixed insecure fallback secret
> is used automatically so the app works without configuration. A warning is
> logged to the console. **Never rely on the fallback in production.**

## Protecting a New Route

Add CSRF protection to any mutating route handler:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';

export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError; // 403 if token is missing or invalid

  // ... handler logic
}
```

## SameSite Cookies

Next.js sets `SameSite=Lax` on session cookies by default, which prevents
cross-site form submissions in most browsers. The CSRF token provides a
stateless defence layer that remains effective even in environments where
the `SameSite` attribute is not enforced.

## Token Expiry and Refresh

Tokens are valid for **60 minutes**. The client-side hook (`useCsrfToken`)
and the `apiFetch` wrapper both:

1. Refresh the token 60 seconds before it expires
2. Retry once with a freshly-fetched token if the server responds with `403`
   (handles the edge case where the token expired in flight)

## Testing

Mutation endpoints return:

```json
{ "error": "Invalid or missing CSRF token" }
```

with HTTP `403` when the `X-CSRF-Token` header is absent, the signature is
invalid, or the token has expired.
