/**
 * Secure server-side session management (#923).
 *
 * Features:
 * - Secure cookie configuration (httpOnly, sameSite, secure)
 * - Session timeout enforcement
 * - Session regeneration on login (prevents session fixation)
 * - Proper logout (clears cookie + invalidates server-side record)
 * - Concurrent session limits per user
 * - Server-side activity tracking
 */

import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum inactive seconds before a session expires. */
export const SESSION_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

/** Maximum concurrent active sessions per user. Oldest is evicted when exceeded. */
export const MAX_CONCURRENT_SESSIONS = 5;

/** Cookie name that carries the session ID. */
export const SESSION_COOKIE_NAME = "stellarsplit_session";

/** HMAC signing key – should be set via SESSION_SIGNING_SECRET env var in production. */
function getSigningSecret(): string {
  return process.env.SESSION_SIGNING_SECRET ?? "stellarsplit-session-dev-secret-32chars!";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRecord {
  /** Opaque session ID (never exposed to clients; cookie carries a signed token). */
  id: string;
  /** Stellar account address for the authenticated user. */
  userId: string;
  /** Unix ms – when the session was first created. */
  createdAt: number;
  /** Unix ms – when the session was last seen active. */
  lastActivity: number;
  /** IP address at creation (best-effort). */
  ipAddress?: string;
  /** User-agent string at creation (best-effort). */
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// In-memory store (replace with Redis / DB in production)
// ---------------------------------------------------------------------------

/** sessionId → SessionRecord */
const SESSION_STORE = new Map<string, SessionRecord>();

/** userId → ordered list of sessionIds (newest last) */
const USER_SESSIONS = new Map<string, string[]>();

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Produces a signed session token: `<sessionId>.<hmac-signature>`.
 * The HMAC prevents a client from guessing or tampering with session IDs.
 */
export function signSession(sessionId: string): string {
  const sig = createHmac("sha256", getSigningSecret())
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

/**
 * Verifies the signature and returns the raw sessionId, or null on failure.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySessionToken(token: string): string | null {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 1) return null;

  const sessionId = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = createHmac("sha256", getSigningSecret())
    .update(sessionId)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;

  return timingSafeEqual(a, b) ? sessionId : null;
}

// ---------------------------------------------------------------------------
// Core session operations
// ---------------------------------------------------------------------------

/**
 * Creates a new session for `userId`, enforcing the concurrent-session limit
 * by evicting the oldest session when the cap is reached.
 */
export function createSession(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): SessionRecord {
  const id = generateId();
  const now = Date.now();

  const record: SessionRecord = {
    id,
    userId,
    createdAt: now,
    lastActivity: now,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };

  SESSION_STORE.set(id, record);

  const userSessions = USER_SESSIONS.get(userId) ?? [];
  userSessions.push(id);

  // Evict oldest sessions that exceed the limit.
  while (userSessions.length > MAX_CONCURRENT_SESSIONS) {
    const evictedId = userSessions.shift();
    if (evictedId) SESSION_STORE.delete(evictedId);
  }

  USER_SESSIONS.set(userId, userSessions);
  return record;
}

/**
 * Looks up an active session by raw session ID, returning null if:
 * - The session doesn't exist.
 * - The session has exceeded SESSION_TIMEOUT_SECONDS since last activity.
 */
export function getSession(sessionId: string): SessionRecord | null {
  const record = SESSION_STORE.get(sessionId);
  if (!record) return null;

  const idleSeconds = (Date.now() - record.lastActivity) / 1000;
  if (idleSeconds > SESSION_TIMEOUT_SECONDS) {
    destroySession(sessionId);
    return null;
  }

  return record;
}

/**
 * Updates the last-activity timestamp for an existing session.
 * Returns false if the session doesn't exist or is already expired.
 */
export function touchSession(sessionId: string): boolean {
  const record = getSession(sessionId);
  if (!record) return false;

  record.lastActivity = Date.now();
  SESSION_STORE.set(sessionId, record);
  return true;
}

/**
 * Destroys a specific session (e.g. on logout or timeout).
 */
export function destroySession(sessionId: string): void {
  const record = SESSION_STORE.get(sessionId);
  if (!record) return;

  SESSION_STORE.delete(sessionId);

  const userSessions = USER_SESSIONS.get(record.userId);
  if (userSessions) {
    const idx = userSessions.indexOf(sessionId);
    if (idx !== -1) userSessions.splice(idx, 1);
    if (userSessions.length === 0) {
      USER_SESSIONS.delete(record.userId);
    } else {
      USER_SESSIONS.set(record.userId, userSessions);
    }
  }
}

/**
 * Destroys all sessions for a user (e.g. password change, account compromise).
 */
export function destroyAllUserSessions(userId: string): void {
  const sessionIds = USER_SESSIONS.get(userId) ?? [];
  for (const id of sessionIds) {
    SESSION_STORE.delete(id);
  }
  USER_SESSIONS.delete(userId);
}

/**
 * Session regeneration — replaces the current session ID with a new one while
 * preserving the userId and metadata. Call this after privilege escalation
 * (e.g. successful login, MFA verification) to prevent session fixation.
 */
export function regenerateSession(
  oldSessionId: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): SessionRecord | null {
  const old = SESSION_STORE.get(oldSessionId);
  if (!old) return null;

  destroySession(oldSessionId);
  return createSession(old.userId, meta);
}

/**
 * Returns all active (non-expired) sessions for a user.
 */
export function listUserSessions(userId: string): SessionRecord[] {
  const ids = USER_SESSIONS.get(userId) ?? [];
  const active: SessionRecord[] = [];
  for (const id of ids) {
    const record = getSession(id); // also evicts stale sessions
    if (record) active.push(record);
  }
  return active;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/** Returns secure cookie options appropriate for the current environment. */
export function sessionCookieOptions(req: NextRequest): {
  httpOnly: boolean;
  sameSite: "strict" | "lax" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  const secure = req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: SESSION_TIMEOUT_SECONDS,
  };
}

/**
 * Sets the signed session cookie on a response.
 */
export function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  req: NextRequest
): void {
  const token = signSession(sessionId);
  const opts = sessionCookieOptions(req);
  response.cookies.set(SESSION_COOKIE_NAME, token, opts);
}

/**
 * Clears the session cookie (used during logout).
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Reads and verifies the session token from an incoming request.
 * Returns the SessionRecord if valid, or null otherwise.
 */
export function getSessionFromRequest(req: NextRequest): SessionRecord | null {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const sessionId = verifySessionToken(token);
  if (!sessionId) return null;

  return getSession(sessionId);
}
