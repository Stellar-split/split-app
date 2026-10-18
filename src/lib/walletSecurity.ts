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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
