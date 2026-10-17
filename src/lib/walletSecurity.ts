/**
 * Client-side wallet security helpers: security tips, secret-key detection,
 * rate limiting for wallet actions, and a small local log of security events
 * that is scanned for suspicious patterns.
 *
 * Nothing here ever stores or transmits key material — detection only looks
 * at whether a string *looks like* a secret so we can warn the user.
 */
import { StrKey } from "@stellar/stellar-sdk";

export interface SecurityTip {
  id: string;
  title: string;
  body: string;
}

export const SECURITY_TIPS: readonly SecurityTip[] = [
  {
    id: "never-share-secret",
    title: "Never share your secret key",
    body: "StellarSplit will never ask for your secret key (starting with S) or recovery phrase. Anyone who has it controls your funds.",
  },
  {
    id: "encrypted-wallet",
    title: "Keep keys in an encrypted wallet",
    body: "Use a wallet like Freighter that encrypts your keys with a password, or a hardware wallet. Don't keep secret keys in notes, screenshots or chat.",
  },
  {
    id: "check-before-signing",
    title: "Read every transaction before signing",
    body: "Check the amount, destination and network in your wallet's confirmation screen. Reject anything you didn't start.",
  },
  {
    id: "check-network",
    title: "Confirm the network",
    body: "Mainnet uses real funds. Make sure the network badge in the header matches the network in your wallet.",
  },
  {
    id: "lock-when-away",
    title: "Lock up when you step away",
    body: "Your session locks automatically after inactivity. Disconnect your wallet on shared or public computers.",
  },
];

// ── Secret material detection ────────────────────────────────────────────────

const SECRET_SEED_PATTERN = /\bS[A-Z2-7]{55}\b/g;

/** True when the text contains a valid Stellar secret seed (S…). */
export function containsSecretKey(text: string): boolean {
  return (text.match(SECRET_SEED_PATTERN) ?? []).some((m) => StrKey.isValidEd25519SecretSeed(m));
}

/**
 * Heuristic for a BIP-39 style recovery phrase: exactly 12, 15, 18, 21 or 24
 * short lowercase words and nothing else.
 */
export function looksLikeRecoveryPhrase(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  return words.every((w) => /^[a-z]{3,8}$/.test(w));
}

export type SecretKind = "secret_key" | "recovery_phrase";

export function detectSecretMaterial(text: string): SecretKind | null {
  if (!text) return null;
  if (containsSecretKey(text)) return "secret_key";
  if (looksLikeRecoveryPhrase(text)) return "recovery_phrase";
  return null;
}

/**
 * Whether the page is served over an encrypted connection. Localhost counts
 * as secure, matching the browser's own `isSecureContext` rules.
 */
export function isConnectionEncrypted(loc: { protocol: string; hostname: string }, secureContext?: boolean): boolean {
  if (secureContext !== undefined) return secureContext;
  return loc.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(loc.hostname);
}

// ── Rate limiting ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the next attempt is allowed (0 when allowed). */
  retryAfterMs: number;
  remaining: number;
}

export interface RateLimiter {
  attempt: (key: string, now?: number) => RateLimitResult;
  reset: (key?: string) => void;
}

/** Sliding-window rate limiter: at most `limit` attempts per `windowMs` per key. */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    attempt(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: windowMs - (now - recent[0]), remaining: 0 };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0, remaining: limit - recent.length };
    },
    reset(key) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
  };
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number, action: string) {
    super(`Too many ${action} attempts. Please wait ${Math.ceil(retryAfterMs / 1000)}s and try again.`);
    this.name = "RateLimitError";
  }
}

/** Wallet connection attempts: 5 per minute. */
export const connectLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
/** Transaction signing requests: 10 per minute. */
export const signLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Throw a `RateLimitError` (and log it) when `limiter` refuses `key`. */
export function enforceRateLimit(limiter: RateLimiter, key: string, action: string): void {
  const result = limiter.attempt(key);
  if (!result.allowed) {
    recordSecurityEvent({ type: "rate_limited", detail: action });
    throw new RateLimitError(result.retryAfterMs, action);
  }
}

// ── Security event log & suspicious activity ────────────────────────────────

export type SecurityEventType =
  | "connect_failed"
  | "sign_rejected"
  | "account_changed"
  | "secret_detected"
  | "rate_limited"
  | "session_locked";

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  detail?: string;
}

export const SECURITY_EVENTS_KEY = "stellarsplit_security_events";
export const SECURITY_EVENT_NAME = "stellarsplit:security-event";
const MAX_EVENTS = 100;

export function readSecurityEvents(): SecurityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SECURITY_EVENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSecurityEvent(event: Omit<SecurityEvent, "timestamp"> & { timestamp?: number }): void {
  if (typeof window === "undefined") return;
  const full: SecurityEvent = { ...event, timestamp: event.timestamp ?? Date.now() };
  try {
    const events = [...readSecurityEvents(), full].slice(-MAX_EVENTS);
    window.localStorage.setItem(SECURITY_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // Storage full or blocked — still notify listeners below.
  }
  window.dispatchEvent(new CustomEvent(SECURITY_EVENT_NAME, { detail: full }));
}

export function clearSecurityEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SECURITY_EVENTS_KEY);
  } catch {
    // ignore
  }
}

export interface WalletSecurityAlert {
  id: string;
  severity: "high" | "medium";
  message: string;
}

const TEN_MINUTES = 10 * 60_000;

/** Scan recent security events for patterns worth warning the user about. */
export function detectWalletAnomalies(events: SecurityEvent[], now = Date.now()): WalletSecurityAlert[] {
  const recent = events.filter((e) => now - e.timestamp <= TEN_MINUTES);
  const count = (type: SecurityEventType) => recent.filter((e) => e.type === type).length;
  const alerts: WalletSecurityAlert[] = [];

  if (count("secret_detected") > 0) {
    alerts.push({
      id: "secret_detected",
      severity: "high",
      message:
        "A secret key or recovery phrase was entered on this page. If you shared it anywhere, move your funds to a new wallet now.",
    });
  }
  if (count("connect_failed") >= 3) {
    alerts.push({
      id: "connect_failed",
      severity: "medium",
      message: `${count("connect_failed")} failed wallet connection attempts in the last 10 minutes.`,
    });
  }
  if (count("sign_rejected") >= 3) {
    alerts.push({
      id: "sign_rejected",
      severity: "medium",
      message: `${count("sign_rejected")} signing requests were rejected or failed in the last 10 minutes. Only approve transactions you started.`,
    });
  }
  if (count("account_changed") >= 2) {
    alerts.push({
      id: "account_changed",
      severity: "medium",
      message: "The connected wallet account changed several times recently. Make sure you're signing with the right account.",
    });
  }
  if (count("rate_limited") > 0) {
    alerts.push({
      id: "rate_limited",
      severity: "medium",
      message: "Wallet actions were temporarily blocked because of unusually frequent requests.",
    });
  }

  return alerts;
}
