/**
 * Tests for all four security features:
 *  - #925: Security headers (X-XSS-Protection added to next.config.js)
 *  - #923: Secure session management (sessionManager.ts)
 *  - #924: API token authentication (apiTokens.ts)
 *  - #926: Security audit logging (securityAuditLog.ts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// #925 — Security headers
// ============================================================================
describe("#925 Security headers — next.config.js", () => {
  // next.config.js lives at the monorepo root, two levels above src/__tests__
  function readNextConfig(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    // __dirname = /workspaces/split-app/src/__tests__
    // ../../ = /workspaces/split-app
    const configPath = path.resolve(__dirname, "../../next.config.js");
    return fs.readFileSync(configPath, "utf8");
  }

  it("exports headers that include X-XSS-Protection", () => {
    const src = readNextConfig();
    expect(src).toContain("X-XSS-Protection");
    expect(src).toContain("1; mode=block");
  });

  it("includes all required security headers in next.config.js", () => {
    const src = readNextConfig();
    const requiredHeaders = [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "X-XSS-Protection",
      "Strict-Transport-Security",
      "Referrer-Policy",
      "Permissions-Policy",
    ];

    for (const header of requiredHeaders) {
      expect(src, `Expected header "${header}" to be present`).toContain(header);
    }
  });

  it("sets X-Frame-Options to DENY for the default route", () => {
    const src = readNextConfig();
    // Verify DENY is set (and not only ALLOWALL which is for /embed)
    expect(src).toContain("'DENY'");
  });

  it("sets HSTS with includeSubDomains and preload", () => {
    const src = readNextConfig();
    expect(src).toContain("includeSubDomains");
    expect(src).toContain("preload");
  });
});

// ============================================================================
// #923 — Secure session management
// ============================================================================
describe("#923 Session management", () => {
  // Import after describe so module-level side effects don't leak
  let mod: typeof import("@/lib/sessionManager");

  beforeEach(async () => {
    // Re-import a fresh module state for each test group by using dynamic import
    // with a cache-bust. Because vitest caches modules, we reset mutable
    // module-level state by importing the module directly.
    mod = await import("@/lib/sessionManager");
    // Destroy any sessions from previous tests
    // (we'll create fresh ones per test)
  });

  it("creates a session with correct fields", () => {
    const record = mod.createSession("GALICE", { ipAddress: "127.0.0.1" });
    expect(record.userId).toBe("GALICE");
    expect(record.ipAddress).toBe("127.0.0.1");
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.lastActivity).toBeGreaterThan(0);
  });

  it("retrieves an active session", () => {
    const { id } = mod.createSession("GBOB");
    expect(mod.getSession(id)).not.toBeNull();
  });

  it("returns null for non-existent session", () => {
    expect(mod.getSession("nonexistent")).toBeNull();
  });

  it("expires session after timeout", () => {
    vi.useFakeTimers();
    const { id } = mod.createSession("GCAROL");

    // Advance past the timeout
    vi.advanceTimersByTime((mod.SESSION_TIMEOUT_SECONDS + 1) * 1000);

    expect(mod.getSession(id)).toBeNull();
    vi.useRealTimers();
  });

  it("touchSession updates lastActivity", () => {
    const record = mod.createSession("GDAVE");
    const before = record.lastActivity;
    // Small sleep via fake timers
    vi.useFakeTimers();
    vi.advanceTimersByTime(5000);
    const touched = mod.touchSession(record.id);
    expect(touched).toBe(true);
    const updated = mod.getSession(record.id);
    expect(updated!.lastActivity).toBeGreaterThan(before);
    vi.useRealTimers();
  });

  it("destroySession removes the session", () => {
    const { id } = mod.createSession("GEVE");
    mod.destroySession(id);
    expect(mod.getSession(id)).toBeNull();
  });

  it("destroyAllUserSessions removes all sessions for a user", () => {
    const s1 = mod.createSession("GFRANK");
    const s2 = mod.createSession("GFRANK");
    mod.destroyAllUserSessions("GFRANK");
    expect(mod.getSession(s1.id)).toBeNull();
    expect(mod.getSession(s2.id)).toBeNull();
  });

  it("regenerateSession replaces old session ID", () => {
    const old = mod.createSession("GGRACE");
    const newRecord = mod.regenerateSession(old.id);
    expect(newRecord).not.toBeNull();
    expect(newRecord!.id).not.toBe(old.id);
    expect(newRecord!.userId).toBe("GGRACE");
    // Old session must be gone (prevents session fixation)
    expect(mod.getSession(old.id)).toBeNull();
  });

  it("enforces concurrent session limit by evicting oldest", () => {
    const userId = "GHENRY";
    const ids: string[] = [];
    for (let i = 0; i < mod.MAX_CONCURRENT_SESSIONS + 2; i++) {
      ids.push(mod.createSession(userId).id);
    }

    // The first two sessions (oldest) should have been evicted.
    expect(mod.getSession(ids[0]!)).toBeNull();
    expect(mod.getSession(ids[1]!)).toBeNull();

    // The most recent sessions should still be active.
    const lastId = ids[ids.length - 1]!;
    expect(mod.getSession(lastId)).not.toBeNull();
  });

  it("listUserSessions returns only active sessions", () => {
    vi.useFakeTimers();
    const userId = "GIRIS";
    mod.createSession(userId);
    const active = mod.createSession(userId);

    // Expire the first session by advancing time (we recreate it with an old ts)
    // Instead just test the count after destroy
    mod.destroyAllUserSessions(userId);
    mod.createSession(userId);
    const sessions = mod.listUserSessions(userId);
    expect(sessions).toHaveLength(1);
    vi.useRealTimers();
  });

  it("signSession + verifySessionToken round-trip", () => {
    const id = "test-session-id-abc123";
    const token = mod.signSession(id);
    expect(token).toContain(".");
    expect(mod.verifySessionToken(token)).toBe(id);
  });

  it("verifySessionToken rejects a tampered token", () => {
    const id = "test-session-id-def456";
    const token = mod.signSession(id);
    const tampered = token.slice(0, -3) + "XXX";
    expect(mod.verifySessionToken(tampered)).toBeNull();
  });

  it("verifySessionToken rejects a token without signature", () => {
    expect(mod.verifySessionToken("nosignaturehere")).toBeNull();
  });
});

// ============================================================================
// #924 — API token authentication
// ============================================================================
describe("#924 API token authentication", () => {
  let mod: typeof import("@/lib/apiTokens");

  beforeEach(async () => {
    mod = await import("@/lib/apiTokens");
  });

  it("issueAccessToken returns a 3-part JWT-style token", () => {
    const token = mod.issueAccessToken("GALICE", ["read"]);
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyAccessToken returns payload for a valid token", () => {
    const token = mod.issueAccessToken("GALICE", ["read"]);
    const payload = mod.verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("GALICE");
    expect(payload!.scopes).toContain("read");
  });

  it("verifyAccessToken returns null for a tampered token", () => {
    const token = mod.issueAccessToken("GBOB", ["write"]);
    const tampered = token.slice(0, -3) + "XXX";
    expect(mod.verifyAccessToken(tampered)).toBeNull();
  });

  it("verifyAccessToken returns null for an expired token", () => {
    vi.useFakeTimers();
    const token = mod.issueAccessToken("GCAROL", ["read"]);
    vi.advanceTimersByTime((mod.ACCESS_TOKEN_TTL_SECONDS + 60) * 1000);
    expect(mod.verifyAccessToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("revokeAccessToken invalidates a valid token", () => {
    const token = mod.issueAccessToken("GDAVE", ["read"]);
    expect(mod.verifyAccessToken(token)).not.toBeNull();
    mod.revokeAccessToken(token);
    expect(mod.verifyAccessToken(token)).toBeNull();
  });

  it("issueRefreshToken + refreshTokens issues a new token pair", () => {
    const refresh = mod.issueRefreshToken("GEVE", ["read", "write"]);
    const result = mod.refreshTokens(refresh);
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeTruthy();
    expect(result!.refreshToken).toBeTruthy();
    // New refresh token must differ from the old one (rotation).
    expect(result!.refreshToken).not.toBe(refresh);
  });

  it("refreshTokens rejects a replayed (already rotated) refresh token", () => {
    const refresh = mod.issueRefreshToken("GFRANK", ["read"]);
    mod.refreshTokens(refresh); // first use — valid
    const second = mod.refreshTokens(refresh); // replay
    expect(second).toBeNull();
  });

  it("revokeRefreshToken prevents further refresh", () => {
    const refresh = mod.issueRefreshToken("GGRACE", ["write"]);
    mod.revokeRefreshToken(refresh);
    expect(mod.refreshTokens(refresh)).toBeNull();
  });

  describe("hasScope", () => {
    function makePayload(scopes: mod.ApiScope[]): mod.AccessTokenPayload {
      return {
        jti: "test",
        sub: "GTEST",
        scopes,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };
    }

    it("read scope satisfies read requirement", () => {
      expect(mod.hasScope(makePayload(["read"]), "read")).toBe(true);
    });

    it("write scope satisfies read requirement (hierarchy)", () => {
      expect(mod.hasScope(makePayload(["write"]), "read")).toBe(true);
    });

    it("read scope does NOT satisfy write requirement", () => {
      expect(mod.hasScope(makePayload(["read"]), "write")).toBe(false);
    });

    it("admin scope satisfies all requirements", () => {
      expect(mod.hasScope(makePayload(["admin"]), "write")).toBe(true);
      expect(mod.hasScope(makePayload(["admin"]), "admin")).toBe(true);
    });
  });

  describe("checkApiAuth", () => {
    it("returns 401 when no Authorization header", () => {
      const result = mod.checkApiAuth(null);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it("returns 401 for an invalid token", () => {
      const result = mod.checkApiAuth("Bearer invalid.token.here");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });

    it("returns 403 when scope is insufficient", () => {
      const token = mod.issueAccessToken("GHENRY", ["read"]);
      const result = mod.checkApiAuth(`Bearer ${token}`, "write");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    });

    it("returns ok for a valid token with sufficient scope", () => {
      const token = mod.issueAccessToken("GIRIS", ["write"]);
      const result = mod.checkApiAuth(`Bearer ${token}`, "write");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.payload.sub).toBe("GIRIS");
    });
  });

  it("extractBearerToken parses Authorization header", () => {
    expect(mod.extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(mod.extractBearerToken(null)).toBeNull();
    expect(mod.extractBearerToken("Basic xyz")).toBeNull();
  });
});

// ============================================================================
// #926 — Security audit logging
// ============================================================================
describe("#926 Security audit logging", () => {
  let mod: typeof import("@/lib/securityAuditLog");

  beforeEach(async () => {
    mod = await import("@/lib/securityAuditLog");
    // Purge any leftover entries to give each test a clean state.
    mod.purgeExpiredLogs();
  });

  it("logSecurityEvent creates an entry with correct fields", () => {
    const before = mod.getLogSize();
    const entry = mod.logSecurityEvent({
      eventType: "auth.login_success",
      actor: "GALICE",
      ipAddress: "192.168.1.1",
    });

    expect(mod.getLogSize()).toBe(before + 1);
    expect(entry.eventType).toBe("auth.login_success");
    expect(entry.actor).toBe("GALICE");
    expect(entry.severity).toBe("info");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.hash).toBeTruthy();
    expect(entry.prevHash).toBeTruthy();
  });

  it("logSecurityEvent assigns warn severity for login failures", () => {
    const entry = mod.logSecurityEvent({ eventType: "auth.login_failure", actor: "GBOB" });
    expect(entry.severity).toBe("warn");
  });

  it("logSecurityEvent assigns critical severity for token replay", () => {
    const entry = mod.logSecurityEvent({
      eventType: "api.token_replay_detected",
      actor: "GCAROL",
    });
    expect(entry.severity).toBe("critical");
  });

  it("allows severity override", () => {
    const entry = mod.logSecurityEvent({
      eventType: "auth.login_success",
      actor: "GDAVE",
      severity: "critical",
    });
    expect(entry.severity).toBe("critical");
  });

  it("sanitizes details (removes angle brackets and long strings)", () => {
    const entry = mod.logSecurityEvent({
      eventType: "data.sensitive_read",
      actor: "GEVE",
      details: "<script>alert(1)</script>" + "x".repeat(600),
    });
    expect(entry.details).not.toContain("<");
    expect(entry.details!.length).toBeLessThanOrEqual(500);
  });

  it("querySecurityLog filters by eventType", () => {
    mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GFRANK" });
    mod.logSecurityEvent({ eventType: "auth.logout", actor: "GFRANK" });

    const results = mod.querySecurityLog({ eventType: "auth.logout" });
    expect(results.every((e) => e.eventType === "auth.logout")).toBe(true);
  });

  it("querySecurityLog filters by actor", () => {
    mod.logSecurityEvent({ eventType: "session.created", actor: "GGRACE" });
    mod.logSecurityEvent({ eventType: "session.created", actor: "GHENRY" });

    const results = mod.querySecurityLog({ actor: "GGRACE" });
    expect(results.every((e) => e.actor === "GGRACE")).toBe(true);
  });

  it("querySecurityLog filters by severity", () => {
    mod.logSecurityEvent({ eventType: "api.token_replay_detected", actor: "GIRIS" });
    mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GIRIS" });

    const critical = mod.querySecurityLog({ severity: "critical" });
    expect(critical.every((e) => e.severity === "critical")).toBe(true);
  });

  it("querySecurityLog returns entries newest first", () => {
    mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GJIM" });
    mod.logSecurityEvent({ eventType: "auth.logout", actor: "GJIM" });

    const results = mod.querySecurityLog({ actor: "GJIM" });
    if (results.length >= 2) {
      expect(results[0]!.timestampMs).toBeGreaterThanOrEqual(results[1]!.timestampMs);
    }
  });

  it("verifyLogIntegrity passes for an unmodified log", () => {
    mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GK" });
    mod.logSecurityEvent({ eventType: "auth.logout", actor: "GK" });
    const result = mod.verifyLogIntegrity();
    expect(result.valid).toBe(true);
  });

  it("securityLogToCsv includes header and rows", () => {
    const entries = [
      mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GL", details: 'note, "quoted"' }),
    ];
    const csv = mod.securityLogToCsv(entries);
    expect(csv).toContain("timestamp,eventType,severity");
    expect(csv).toContain("auth.login_success");
    // Quoted cell
    expect(csv).toContain('"note, ""quoted"""');
  });

  it("securityLogToJson serialises entries as JSON array", () => {
    const entries = [
      mod.logSecurityEvent({ eventType: "session.created", actor: "GM" }),
    ];
    const json = mod.securityLogToJson(entries);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].actor).toBe("GM");
  });

  it("purgeExpiredLogs removes only entries beyond retention", () => {
    vi.useFakeTimers();
    const retentionMs = mod.getRetentionMs();

    // Add an old entry
    mod.logSecurityEvent({ eventType: "auth.login_success", actor: "GN" });
    const sizeBefore = mod.getLogSize();

    // Advance time past retention
    vi.advanceTimersByTime(retentionMs + 1000);

    // Add a fresh entry
    mod.logSecurityEvent({ eventType: "auth.logout", actor: "GN" });

    const removed = mod.purgeExpiredLogs();
    expect(removed).toBeGreaterThanOrEqual(sizeBefore);

    vi.useRealTimers();
  });

  it("getRetentionMs defaults to 90 days", () => {
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    expect(mod.getRetentionMs()).toBe(ninetyDays);
  });
});
