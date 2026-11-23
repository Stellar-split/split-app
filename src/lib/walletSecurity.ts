/**
 * Wallet security helpers (#919 "Implement wallet private key security
 * best practices").
 *
 * This app never holds raw private keys itself -- signing is delegated to
 * an external wallet (Freighter / WalletConnect, see src/lib/freighter.ts
 * and src/lib/stores/walletStore.ts), which is the recommended best
 * practice: keys never touch application memory or network requests.
 *
 * These helpers harden the surfaces that remain under this app's control:
 * - guarding against accidentally logging secret-looking values
 * - idle session timeout for a connected wallet
 * - secure random generation for any client-side tokens/nonces
 * - securely clearing sensitive values from memory once no longer needed
 *
 * See docs/SECURITY.md for the full wallet security practices this
 * implements.
 */

import { StrKey } from "@stellar/stellar-sdk";

/** Matches common secret-key shapes so they never make it into logs. */
const SECRET_LIKE_PATTERN = /^S[A-Z0-9]{55}$/; // Stellar secret seed (StrKey "S...")

/**
 * Wraps console.* so any value that looks like a private key / secret seed
 * is redacted instead of printed. Call once at app startup (see
 * src/instrumentation.ts / instrumentation-client.ts).
 */
export function installSecretRedactingLogger() {
  if (typeof console === "undefined") return;
  const methods: Array<keyof Console> = ["log", "warn", "error", "info", "debug"];

  for (const method of methods) {
    const original = console[method] as (...args: unknown[]) => void;
    if (!original || (original as unknown as { __secretRedacted?: boolean }).__secretRedacted) {
      continue;
    }
    const wrapped = (...args: unknown[]) => {
      original(...args.map(redactSecretsDeep));
    };
    (wrapped as unknown as { __secretRedacted: boolean }).__secretRedacted = true;
    (console[method] as unknown) = wrapped;
  }
}

function redactSecretsDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_LIKE_PATTERN.test(value) ? "[REDACTED_SECRET]" : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSecretsDeep);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /secret|private.?key|seed/i.test(k) ? "[REDACTED_SECRET]" : redactSecretsDeep(v);
    }
    return out;
  }
  return value;
}

/** Cryptographically secure random bytes (never Math.random for security-sensitive values). */
export function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js server-side fallback.
    const nodeCrypto = require("crypto");
    nodeCrypto.randomFillSync(bytes);
  }
  return bytes;
}

export function secureRandomToken(length = 32): string {
  return Array.from(secureRandomBytes(length))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Best-effort in-memory wipe. JS strings are immutable so this cannot
 * guarantee the underlying memory is zeroed, but for mutable buffers
 * (Uint8Array) it overwrites the bytes so the value doesn't linger in a
 * variable/closure after use.
 */
export function secureWipe(buffer: Uint8Array): void {
  buffer.fill(0);
}

export interface SecurityTip {
  id: string;
  title: string;
  body: string;
}

export const SECURITY_TIPS: readonly SecurityTip[] = [
  { id: "never-share-secret", title: "Never share your secret key", body: "StellarSplit will never ask for your secret key or recovery phrase. Anyone who has it controls your funds." },
  { id: "encrypted-wallet", title: "Keep keys in an encrypted wallet", body: "Use an encrypted wallet or hardware wallet. Don't keep secret keys in notes, screenshots or chat." },
  { id: "check-before-signing", title: "Read every transaction before signing", body: "Check the amount, destination and network in your wallet's confirmation screen. Reject anything you didn't start." },
  { id: "check-network", title: "Confirm the network", body: "Mainnet uses real funds. Make sure the network badge matches the network in your wallet." },
  { id: "lock-when-away", title: "Lock when you step away", body: "Your session locks automatically after inactivity. Disconnect your wallet on shared or public computers." },
];

const SECRET_SEED_PATTERN = /\bS[A-Z2-7]{55}\b/g;

export function containsSecretKey(text: string): boolean {
  return (text.match(SECRET_SEED_PATTERN) ?? []).some((value) => StrKey.isValidEd25519SecretSeed(value));
}

export function looksLikeRecoveryPhrase(text: string): boolean {
  const words = text.trim().split(/\s+/);
  return [12, 15, 18, 21, 24].includes(words.length) && words.every((word) => /^[a-z]{3,8}$/.test(word));
}

export type SecretKind = "secret_key" | "recovery_phrase";

export function detectSecretMaterial(text: string): SecretKind | null {
  if (!text) return null;
  if (containsSecretKey(text)) return "secret_key";
  if (looksLikeRecoveryPhrase(text)) return "recovery_phrase";
  return null;
}

export function isConnectionEncrypted(
  location: { protocol: string; hostname: string },
  secureContext?: boolean,
): boolean {
  if (secureContext !== undefined) return secureContext;
  return location.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export interface RateLimiter {
  attempt: (key: string, now?: number) => RateLimitResult;
  reset: (key?: string) => void;
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    attempt(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
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

export const connectLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
export const signLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export function enforceRateLimit(limiter: RateLimiter, key: string, action: string): void {
  const result = limiter.attempt(key);
  if (!result.allowed) {
    recordSecurityEvent({ type: "rate_limited", detail: action });
    throw new RateLimitError(result.retryAfterMs, action);
  }
}

export type SecurityEventType =
  | "connect_failed"
  | "sign_rejected"
  | "account_changed"
  | "secret_detected"
  | "rate_limited"
  | "session_locked"
  | "biometric_enrolled"
  | "biometric_disabled"
  | "biometric_success"
  | "biometric_failed";

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
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SECURITY_EVENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as SecurityEvent[] : [];
  } catch {
    return [];
  }
}

export function recordSecurityEvent(event: Omit<SecurityEvent, "timestamp"> & { timestamp?: number }): void {
  if (typeof window === "undefined") return;
  const full: SecurityEvent = { ...event, timestamp: event.timestamp ?? Date.now() };
  try {
    window.localStorage.setItem(SECURITY_EVENTS_KEY, JSON.stringify([...readSecurityEvents(), full].slice(-MAX_EVENTS)));
  } catch {
    // Still notify listeners if local storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(SECURITY_EVENT_NAME, { detail: full }));
}

export function clearSecurityEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SECURITY_EVENTS_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export interface WalletSecurityAlert {
  id: string;
  severity: "high" | "medium";
  message: string;
}

const TEN_MINUTES = 10 * 60_000;

export function detectWalletAnomalies(events: SecurityEvent[], now = Date.now()): WalletSecurityAlert[] {
  const recent = events.filter((event) => now - event.timestamp <= TEN_MINUTES);
  const count = (type: SecurityEventType) => recent.filter((event) => event.type === type).length;
  const alerts: WalletSecurityAlert[] = [];

  if (count("secret_detected") > 0) {
    alerts.push({ id: "secret_detected", severity: "high", message: "A secret key or recovery phrase was entered on this page. If you shared it anywhere, move your funds to a new wallet now." });
  }
  if (count("connect_failed") >= 3) {
    alerts.push({ id: "connect_failed", severity: "medium", message: `${count("connect_failed")} failed wallet connection attempts in the last 10 minutes.` });
  }
  if (count("sign_rejected") >= 3) {
    alerts.push({ id: "sign_rejected", severity: "medium", message: `${count("sign_rejected")} signing requests were rejected or failed in the last 10 minutes. Only approve transactions you started.` });
  }
  if (count("account_changed") >= 2) {
    alerts.push({ id: "account_changed", severity: "medium", message: "The connected wallet account changed several times recently. Make sure you're signing with the right account." });
  }
  if (count("rate_limited") > 0) {
    alerts.push({ id: "rate_limited", severity: "medium", message: "Wallet actions were temporarily blocked because of unusually frequent requests." });
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Idle session timeout for a connected wallet
// ---------------------------------------------------------------------------

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface WalletSessionTimeoutHandle {
  stop: () => void;
}

/**
 * Starts an idle timer that calls `onTimeout` (typically wallet
 * disconnect) after `idleTimeoutMs` of no user activity. Resets on mouse,
 * keyboard, and touch events.
 */
export function startWalletSessionTimeout(
  onTimeout: () => void,
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
): WalletSessionTimeoutHandle {
  if (typeof window === "undefined") {
    return { stop: () => {} };
  }

  let timer: ReturnType<typeof setTimeout>;

  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(onTimeout, idleTimeoutMs);
  };

  const activityEvents = ["mousemove", "keydown", "click", "touchstart", "scroll"];
  activityEvents.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
  reset();

  return {
    stop: () => {
      clearTimeout(timer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, reset));
    },
  };
}
