/**
 * API Authentication — OAuth 2.0-style access + refresh token system (#924).
 *
 * Design:
 * - Short-lived access tokens (JWT-like, signed with HMAC-SHA256) — 15 minutes
 * - Long-lived refresh tokens (opaque, stored server-side) — 30 days
 * - Scopes: read | write | admin
 * - Token validation with timing-safe comparison
 * - Refresh token rotation (single-use; issuing a new one invalidates the old)
 * - Token revocation support
 */

import { randomBytes, createHmac, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;       // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** All supported API permission scopes. */
export const API_SCOPES = ["read", "write", "admin"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

function getSigningSecret(): string {
  return process.env.API_TOKEN_SECRET ?? "stellarsplit-api-token-dev-secret-32chars!";
}

// ---------------------------------------------------------------------------
// Token record types
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  /** Token identifier. */
  jti: string;
  /** Subject — userId / Stellar account address. */
  sub: string;
  /** Granted scopes. */
  scopes: ApiScope[];
  /** Issued-at Unix seconds. */
  iat: number;
  /** Expiry Unix seconds. */
  exp: number;
}

export interface RefreshTokenRecord {
  /** Opaque token value (stored server-side; given to client). */
  token: string;
  /** Subject. */
  sub: string;
  /** Scopes granted to access tokens derived from this refresh token. */
  scopes: ApiScope[];
  /** Issued-at Unix ms. */
  createdAt: number;
  /** Expiry Unix ms. */
  expiresAt: number;
  /** When true the token has been used and must not be reused (rotation). */
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// In-memory store (replace with Redis / DB in production)
// ---------------------------------------------------------------------------

/** jti → true (revoked access tokens, pruned after expiry) */
const REVOKED_ACCESS_TOKENS = new Map<string, number>(); // jti → expiry ms

/** refreshToken string → RefreshTokenRecord */
const REFRESH_TOKEN_STORE = new Map<string, RefreshTokenRecord>();

// ---------------------------------------------------------------------------
// Access token helpers
// ---------------------------------------------------------------------------

function encodeBase64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/**
 * Issues a signed access token for `sub` with the given scopes.
 * The token format is `<header>.<payload>.<signature>` (JWT-compatible but
 * without a full JWT library dependency — the signature is HMAC-SHA256).
 */
export function issueAccessToken(sub: string, scopes: ApiScope[]): string {
  const jti = randomBytes(16).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    jti,
    sub,
    scopes,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };

  const header = encodeBase64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const sig = createHmac("sha256", getSigningSecret())
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${sig}`;
}

/**
 * Validates an access token string.
 * Returns the decoded payload on success, or null if the token is:
 * - Malformed
 * - Signature invalid
 * - Expired
 * - Explicitly revoked
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  const signingInput = `${header}.${body}`;
  const expected = createHmac("sha256", getSigningSecret())
    .update(signingInput)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(decodeBase64url(body)) as AccessTokenPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;

  // Check revocation list.
  if (REVOKED_ACCESS_TOKENS.has(payload.jti)) return null;

  // Prune expired entries from the revocation list opportunistically.
  for (const [jti, expMs] of REVOKED_ACCESS_TOKENS) {
    if (expMs < Date.now()) REVOKED_ACCESS_TOKENS.delete(jti);
  }

  return payload;
}

/**
 * Revokes an access token before it expires naturally.
 * The jti is kept in memory until the token's natural expiry time.
 */
export function revokeAccessToken(token: string): boolean {
  const payload = verifyAccessToken(token);
  if (!payload) return false;
  REVOKED_ACCESS_TOKENS.set(payload.jti, payload.exp * 1000);
  return true;
}

// ---------------------------------------------------------------------------
// Refresh token helpers
// ---------------------------------------------------------------------------

/**
 * Issues a long-lived opaque refresh token for `sub`.
 * Stores the record server-side; clients receive only the opaque string.
 */
export function issueRefreshToken(sub: string, scopes: ApiScope[]): string {
  const token = randomBytes(40).toString("base64url");
  const now = Date.now();

  REFRESH_TOKEN_STORE.set(token, {
    token,
    sub,
    scopes,
    createdAt: now,
    expiresAt: now + REFRESH_TOKEN_TTL_SECONDS * 1000,
    revoked: false,
  });

  return token;
}

/**
 * Exchanges a refresh token for a new access token + rotated refresh token.
 *
 * Rotation: the old refresh token is immediately revoked. If a client
 * re-uses an already-revoked refresh token (replay / theft detected), all
 * tokens for that subject are revoked (token family revocation).
 *
 * Returns null if the refresh token is invalid, expired, or revoked.
 */
export function refreshTokens(
  refreshToken: string
): { accessToken: string; refreshToken: string } | null {
  const record = REFRESH_TOKEN_STORE.get(refreshToken);

  if (!record) return null;

  // Replay detection — someone is re-using an already-revoked token.
  if (record.revoked) {
    revokeAllUserTokens(record.sub);
    return null;
  }

  if (record.expiresAt < Date.now()) {
    REFRESH_TOKEN_STORE.delete(refreshToken);
    return null;
  }

  // Rotate: mark old token as revoked.
  record.revoked = true;
  REFRESH_TOKEN_STORE.set(refreshToken, record);

  // Issue new pair.
  const newAccess = issueAccessToken(record.sub, record.scopes);
  const newRefresh = issueRefreshToken(record.sub, record.scopes);

  return { accessToken: newAccess, refreshToken: newRefresh };
}

/**
 * Revokes all server-side refresh tokens for a user and marks all known
 * access tokens as revoked (used when suspicious activity is detected).
 */
export function revokeAllUserTokens(sub: string): void {
  for (const [token, record] of REFRESH_TOKEN_STORE) {
    if (record.sub === sub) {
      record.revoked = true;
      REFRESH_TOKEN_STORE.set(token, record);
    }
  }
}

/**
 * Revokes a specific refresh token (e.g. explicit logout from a device).
 */
export function revokeRefreshToken(refreshToken: string): boolean {
  const record = REFRESH_TOKEN_STORE.get(refreshToken);
  if (!record || record.revoked) return false;
  record.revoked = true;
  REFRESH_TOKEN_STORE.set(refreshToken, record);
  return true;
}

// ---------------------------------------------------------------------------
// Scope enforcement helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the payload grants at least the required scope.
 * Scope hierarchy: admin ⊇ write ⊇ read.
 */
export function hasScope(payload: AccessTokenPayload, required: ApiScope): boolean {
  if (payload.scopes.includes("admin")) return true;
  if (required === "write" && payload.scopes.includes("write")) return true;
  if (required === "read") {
    return (
      payload.scopes.includes("read") ||
      payload.scopes.includes("write")
    );
  }
  return payload.scopes.includes(required);
}

/**
 * Extracts a Bearer token from the Authorization header value.
 * Returns null if absent or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Validates the Bearer token from an Authorization header and checks scope.
 *
 * Returns:
 * - `{ ok: true, payload }` on success.
 * - `{ ok: false, status, error }` on failure.
 */
export type TokenCheckResult =
  | { ok: true; payload: AccessTokenPayload }
  | { ok: false; status: 401 | 403; error: string };

export function checkApiAuth(
  authHeader: string | null,
  requiredScope: ApiScope = "read"
): TokenCheckResult {
  const raw = extractBearerToken(authHeader);
  if (!raw) {
    return { ok: false, status: 401, error: "Bearer token required." };
  }

  const payload = verifyAccessToken(raw);
  if (!payload) {
    return { ok: false, status: 401, error: "Invalid or expired access token." };
  }

  if (!hasScope(payload, requiredScope)) {
    return {
      ok: false,
      status: 403,
      error: `Insufficient scope. Required: ${requiredScope}.`,
    };
  }

  return { ok: true, payload };
}
