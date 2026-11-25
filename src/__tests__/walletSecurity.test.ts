import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import {
  SECURITY_EVENTS_KEY,
  SECURITY_EVENT_NAME,
  SECURITY_TIPS,
  RateLimitError,
  clearSecurityEvents,
  containsSecretKey,
  createRateLimiter,
  detectSecretMaterial,
  detectWalletAnomalies,
  enforceRateLimit,
  isConnectionEncrypted,
  looksLikeRecoveryPhrase,
  readSecurityEvents,
  recordSecurityEvent,
  type SecurityEvent,
} from "@/lib/walletSecurity";

const SECRET = StrKey.encodeEd25519SecretSeed(Buffer.alloc(32, 9));
const PUBLIC = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
const PHRASE = "abandon ability able about above absent absorb abstract absurd abuse access accident";

describe("wallet security (#890)", () => {
  beforeEach(() => localStorage.clear());

  it("has security tips with titles and bodies", () => {
    expect(SECURITY_TIPS.length).toBeGreaterThanOrEqual(4);
    SECURITY_TIPS.forEach((t) => {
      expect(t.title).toBeTruthy();
      expect(t.body).toBeTruthy();
    });
  });

  describe("secret detection", () => {
    it("finds a valid secret seed, alone or inside other text", () => {
      expect(containsSecretKey(SECRET)).toBe(true);
      expect(containsSecretKey(`my key is ${SECRET} ok`)).toBe(true);
    });

    it("ignores public keys and look-alikes with a bad checksum", () => {
      expect(containsSecretKey(PUBLIC)).toBe(false);
      expect(containsSecretKey("S" + "A".repeat(55))).toBe(false);
    });

    it("recognises a 12-word recovery phrase but not normal sentences", () => {
      expect(looksLikeRecoveryPhrase(PHRASE)).toBe(true);
      expect(looksLikeRecoveryPhrase("Thanks for the design work on the Q3 landing page, invoice attached")).toBe(false);
      expect(looksLikeRecoveryPhrase("one two three")).toBe(false);
    });

    it("classifies the kind of secret", () => {
      expect(detectSecretMaterial(SECRET)).toBe("secret_key");
      expect(detectSecretMaterial(PHRASE)).toBe("recovery_phrase");
      expect(detectSecretMaterial(PUBLIC)).toBeNull();
      expect(detectSecretMaterial("")).toBeNull();
    });
  });

  it("treats https and localhost as encrypted", () => {
    expect(isConnectionEncrypted({ protocol: "https:", hostname: "app.example" })).toBe(true);
    expect(isConnectionEncrypted({ protocol: "http:", hostname: "localhost" })).toBe(true);
    expect(isConnectionEncrypted({ protocol: "http:", hostname: "app.example" })).toBe(false);
    expect(isConnectionEncrypted({ protocol: "https:", hostname: "x" }, false)).toBe(false);
  });

  describe("rate limiting", () => {
    it("allows up to the limit inside the window, then blocks with a retry time", () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
      expect(limiter.attempt("k", 0).allowed).toBe(true);
      expect(limiter.attempt("k", 100).allowed).toBe(true);
      expect(limiter.attempt("k", 200).remaining).toBe(0);
      const blocked = limiter.attempt("k", 300);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBe(700);
    });

    it("frees slots as the window slides and keeps keys independent", () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
      expect(limiter.attempt("a", 0).allowed).toBe(true);
      expect(limiter.attempt("b", 0).allowed).toBe(true);
      expect(limiter.attempt("a", 500).allowed).toBe(false);
      expect(limiter.attempt("a", 1000).allowed).toBe(true);
    });

    it("enforceRateLimit throws a RateLimitError and logs the event", () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
      enforceRateLimit(limiter, "x", "test");
      expect(() => enforceRateLimit(limiter, "x", "test")).toThrow(RateLimitError);
      expect(readSecurityEvents().map((e) => e.type)).toContain("rate_limited");
    });
  });

  describe("security event log", () => {
    it("records events, notifies listeners and can be cleared", () => {
      const listener = vi.fn();
      window.addEventListener(SECURITY_EVENT_NAME, listener);
      recordSecurityEvent({ type: "connect_failed", detail: "freighter" });
      window.removeEventListener(SECURITY_EVENT_NAME, listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(readSecurityEvents()[0]).toMatchObject({ type: "connect_failed", detail: "freighter" });
      clearSecurityEvents();
      expect(readSecurityEvents()).toEqual([]);
    });

    it("keeps only the latest 100 events and survives corrupt storage", () => {
      for (let i = 0; i < 120; i++) recordSecurityEvent({ type: "session_locked", timestamp: i });
      const events = readSecurityEvents();
      expect(events).toHaveLength(100);
      expect(events[0].timestamp).toBe(20);

      localStorage.setItem(SECURITY_EVENTS_KEY, "not json");
      expect(readSecurityEvents()).toEqual([]);
    });
  });

  describe("suspicious activity detection", () => {
    const now = 1_000_000_000;
    const ev = (type: SecurityEvent["type"], agoMs = 0): SecurityEvent => ({ type, timestamp: now - agoMs });

    it("is quiet for normal activity", () => {
      expect(detectWalletAnomalies([ev("connect_failed"), ev("session_locked")], now)).toEqual([]);
    });

    it("flags repeated failures and rejections", () => {
      const ids = detectWalletAnomalies(
        [ev("connect_failed"), ev("connect_failed"), ev("connect_failed"), ev("sign_rejected"), ev("sign_rejected"), ev("sign_rejected")],
        now
      ).map((a) => a.id);
      expect(ids).toEqual(expect.arrayContaining(["connect_failed", "sign_rejected"]));
    });

    it("treats an exposed secret as high severity", () => {
      const [alert] = detectWalletAnomalies([ev("secret_detected")], now);
      expect(alert).toMatchObject({ id: "secret_detected", severity: "high" });
    });

    it("flags account switching and rate limiting", () => {
      const ids = detectWalletAnomalies([ev("account_changed"), ev("account_changed"), ev("rate_limited")], now).map(
        (a) => a.id
      );
      expect(ids).toEqual(expect.arrayContaining(["account_changed", "rate_limited"]));
    });

    it("ignores events older than 10 minutes", () => {
      const old = 11 * 60_000;
      expect(detectWalletAnomalies([ev("connect_failed", old), ev("connect_failed", old), ev("connect_failed", old)], now)).toEqual([]);
    });
  });
});
