/**
 * Security audit logging for sensitive operations (#926).
 *
 * Features:
 * - Well-defined security event types (auth, session, API, admin, data)
 * - Append-only log entries with tamper-detection hash chain
 * - Severity levels (info | warn | critical)
 * - Log retention policy with automatic purge of entries older than retention window
 * - CSV and JSON export
 * - Searchable by actor, event type, severity, and time range
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export const SECURITY_EVENT_TYPES = [
  // Authentication
  "auth.login_success",
  "auth.login_failure",
  "auth.logout",
  "auth.mfa_enabled",
  "auth.mfa_disabled",
  "auth.mfa_success",
  "auth.mfa_failure",
  "auth.password_reset_requested",
  // Session
  "session.created",
  "session.destroyed",
  "session.expired",
  "session.regenerated",
  "session.concurrent_limit_eviction",
  // API tokens
  "api.token_issued",
  "api.token_refreshed",
  "api.token_revoked",
  "api.token_replay_detected",
  "api.access_denied",
  // Administrative
  "admin.settings_changed",
  "admin.user_locked",
  "admin.user_unlocked",
  "admin.keys_rotated",
  // Data / sensitive operations
  "data.export_requested",
  "data.bulk_delete",
  "data.sensitive_read",
  // Security headers / config
  "security.headers_applied",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export type SecurityEventSeverity = "info" | "warn" | "critical";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityAuditEntry {
  /** Sequential log entry identifier. */
  id: string;
  /** ISO-8601 timestamp string. */
  timestamp: string;
  /** Unix ms — for sorting and range queries. */
  timestampMs: number;
  /** Specific security event type. */
  eventType: SecurityEventType;
  /** Severity of the event. */
  severity: SecurityEventSeverity;
  /** Stellar address or service identity of the actor. */
  actor: string;
  /** Optional resource being acted on (invoice ID, session ID, etc.). */
  target?: string;
  /** Free-form additional context (sanitised before storage). */
  details?: string;
  /** IP address of the request (best-effort). */
  ipAddress?: string;
  /** SHA-256 hash of the previous entry ID + this entry's core fields.
   *  Provides a basic tamper-evident chain — any modification breaks the chain. */
  prevHash: string;
  /** Hash of this entry's own content (for integrity verification). */
  hash: string;
}

export interface SecurityAuditFilter {
  eventType?: SecurityEventType;
  severity?: SecurityEventSeverity;
  actor?: string;
  fromMs?: number;
  toMs?: number;
  query?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default retention: 90 days. Configurable via AUDIT_LOG_RETENTION_DAYS. */
export function getRetentionMs(): number {
  const days = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? "90", 10);
  return (isNaN(days) ? 90 : Math.max(1, days)) * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

const SEVERITY_MAP: Record<SecurityEventType, SecurityEventSeverity> = {
  "auth.login_success": "info",
  "auth.login_failure": "warn",
  "auth.logout": "info",
  "auth.mfa_enabled": "info",
  "auth.mfa_disabled": "warn",
  "auth.mfa_success": "info",
  "auth.mfa_failure": "warn",
  "auth.password_reset_requested": "warn",
  "session.created": "info",
  "session.destroyed": "info",
  "session.expired": "info",
  "session.regenerated": "info",
  "session.concurrent_limit_eviction": "warn",
  "api.token_issued": "info",
  "api.token_refreshed": "info",
  "api.token_revoked": "info",
  "api.token_replay_detected": "critical",
  "api.access_denied": "warn",
  "admin.settings_changed": "warn",
  "admin.user_locked": "warn",
  "admin.user_unlocked": "info",
  "admin.keys_rotated": "info",
  "data.export_requested": "info",
  "data.bulk_delete": "warn",
  "data.sensitive_read": "info",
  "security.headers_applied": "info",
};

export function getSeverity(eventType: SecurityEventType): SecurityEventSeverity {
  return SEVERITY_MAP[eventType] ?? "info";
}

// ---------------------------------------------------------------------------
// In-memory append-only log store
// ---------------------------------------------------------------------------

const LOG_STORE: SecurityAuditEntry[] = [];

let entryCounter = 0;

function generateEntryId(): string {
  return `sec-${Date.now()}-${(++entryCounter).toString().padStart(6, "0")}`;
}

function computeHash(entry: Omit<SecurityAuditEntry, "hash">): string {
  const content = JSON.stringify({
    id: entry.id,
    timestampMs: entry.timestampMs,
    eventType: entry.eventType,
    severity: entry.severity,
    actor: entry.actor,
    target: entry.target,
    details: entry.details,
    prevHash: entry.prevHash,
  });
  return createHash("sha256").update(content).digest("hex");
}

function getLastHash(): string {
  if (LOG_STORE.length === 0) return "genesis";
  return LOG_STORE[LOG_STORE.length - 1]!.hash;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a new security event to the audit log.
 * The entry is made immutable (Object.freeze) after creation.
 */
export function logSecurityEvent(params: {
  eventType: SecurityEventType;
  actor: string;
  target?: string;
  details?: string;
  ipAddress?: string;
  /** Override automatic severity mapping (optional). */
  severity?: SecurityEventSeverity;
}): SecurityAuditEntry {
  const now = Date.now();
  const id = generateEntryId();
  const prevHash = getLastHash();
  const severity = params.severity ?? getSeverity(params.eventType);

  const partial: Omit<SecurityAuditEntry, "hash"> = {
    id,
    timestamp: new Date(now).toISOString(),
    timestampMs: now,
    eventType: params.eventType,
    severity,
    actor: params.actor,
    target: params.target,
    details: params.details ? sanitizeDetails(params.details) : undefined,
    ipAddress: params.ipAddress,
    prevHash,
  };

  const entry: SecurityAuditEntry = Object.freeze({
    ...partial,
    hash: computeHash(partial),
  });

  LOG_STORE.push(entry);
  return entry;
}

/**
 * Strips any characters that could constitute script injection or log
 * injection (newlines, angle brackets, null bytes).
 */
function sanitizeDetails(input: string): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // control chars except tab/newline
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, 500); // max 500 chars per details field
}

/**
 * Returns all entries that match the filter, newest first.
 */
export function querySecurityLog(filter: SecurityAuditFilter = {}): SecurityAuditEntry[] {
  const q = filter.query?.trim().toLowerCase();

  return LOG_STORE.slice() // copy so caller can't mutate the store
    .filter((e) => {
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      if (filter.severity && e.severity !== filter.severity) return false;
      if (filter.actor && !e.actor.toLowerCase().includes(filter.actor.toLowerCase())) return false;
      if (filter.fromMs !== undefined && e.timestampMs < filter.fromMs) return false;
      if (filter.toMs !== undefined && e.timestampMs > filter.toMs) return false;
      if (q) {
        const searchable = [e.actor, e.eventType, e.target, e.details, e.ipAddress]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

/**
 * Purges log entries older than the configured retention window.
 * Returns the number of entries removed.
 */
export function purgeExpiredLogs(): number {
  const cutoff = Date.now() - getRetentionMs();
  let removed = 0;
  // Walk from the start (oldest) and remove while below cutoff.
  while (LOG_STORE.length > 0 && LOG_STORE[0]!.timestampMs < cutoff) {
    LOG_STORE.shift();
    removed++;
  }
  return removed;
}

/**
 * Returns the total number of entries currently in the log (before any purge).
 */
export function getLogSize(): number {
  return LOG_STORE.length;
}

/**
 * Verifies the integrity of the entire hash chain.
 * Returns `{ valid: true }` when no tampering detected, or
 * `{ valid: false, brokenAt: <id> }` identifying the first broken link.
 */
export function verifyLogIntegrity(): { valid: true } | { valid: false; brokenAt: string } {
  let prevHash = "genesis";

  for (const entry of LOG_STORE) {
    if (entry.prevHash !== prevHash) {
      return { valid: false, brokenAt: entry.id };
    }
    const recomputed = computeHash({ ...entry });
    if (recomputed !== entry.hash) {
      return { valid: false, brokenAt: entry.id };
    }
    prevHash = entry.hash;
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Serialises the given entries (or all stored entries) to CSV.
 */
export function securityLogToCsv(entries?: SecurityAuditEntry[]): string {
  const rows = entries ?? LOG_STORE;
  const header = "timestamp,eventType,severity,actor,target,details,ipAddress,id";
  const lines = rows.map((e) =>
    [
      e.timestamp,
      e.eventType,
      e.severity,
      e.actor,
      e.target ?? "",
      e.details ?? "",
      e.ipAddress ?? "",
      e.id,
    ]
      .map(csvCell)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

/**
 * Serialises entries to a JSON array string (suitable for file export).
 */
export function securityLogToJson(entries?: SecurityAuditEntry[]): string {
  const rows = entries ?? LOG_STORE;
  return JSON.stringify(rows, null, 2);
}
