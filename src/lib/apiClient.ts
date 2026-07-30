"use client";

/**
 * Centralized fetch wrapper for mutating API calls. Injects the
 * `X-CSRF-Token` header (see src/lib/csrf.ts / src/lib/middleware/csrfMiddleware.ts)
 * on POST/PUT/PATCH/DELETE requests, refreshing the cached token before it
 * expires and transparently retrying once if a request is rejected with 403
 * because the token expired mid-flight.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Refresh a little early so a request that starts right before expiry
// doesn't race the server-side clock.
const REFRESH_SKEW_MS = 60 * 1000;

let cachedToken: string | null = null;
let cachedExpiresAt = 0;
let inflightFetch: Promise<string> | null = null;

async function fetchFreshToken(): Promise<string> {
  const response = await fetch("/api/csrf");
  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  const data = await response.json();
  cachedToken = data.token;
  cachedExpiresAt = data.expiresAt;
  return data.token;
}

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedExpiresAt - REFRESH_SKEW_MS) {
    return cachedToken;
  }
  if (!forceRefresh && inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = fetchFreshToken().finally(() => {
    inflightFetch = null;
  });
  return inflightFetch;
}

export function getCachedCsrfExpiry(): number {
  return cachedExpiresAt;
}

/**
 * fetch() wrapper that attaches a CSRF token to mutating requests and
 * retries once, with a freshly-fetched token, if the server rejects the
 * first attempt with 403.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return fetch(input, init);
  }

  const attempt = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("X-CSRF-Token", token);
    return fetch(input, { ...init, headers });
  };

  const token = await getCsrfToken();
  const response = await attempt(token);
  if (response.status !== 403) {
    return response;
  }

  const freshToken = await getCsrfToken(true);
  return attempt(freshToken);
}
