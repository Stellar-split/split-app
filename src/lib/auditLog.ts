export type AuditCategory = "invoice" | "payment" | "auth" | "settings" | "admin";

export interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  category: AuditCategory;
  target?: string;
  details?: string;
}

export interface AuditFilter {
  query?: string;
  category?: AuditCategory | "all";
  from?: number;
  to?: number;
}

export function filterAuditEntries(entries: AuditEntry[], filter: AuditFilter = {}): AuditEntry[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  return entries
    .filter((e) => !filter.category || filter.category === "all" || e.category === filter.category)
    .filter((e) => filter.from === undefined || e.timestamp >= filter.from)
    .filter((e) => filter.to === undefined || e.timestamp <= filter.to)
    .filter(
      (e) =>
        !q ||
        [e.actor, e.action, e.target, e.details].some((f) => f?.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

export interface InvoiceAmendmentAuditInput {
  id: string;
  timestamp?: number;
  actor: string;
  invoiceId: string;
  reason: string;
  changedFields: string[];
  comment?: string;
  version?: number;
}

export function createInvoiceAmendmentAuditEntry(input: InvoiceAmendmentAuditInput): AuditEntry {
  const parts: string[] = [`Reason: ${input.reason}`];
  if (input.changedFields.length > 0) {
    parts.push(`Changed fields: ${input.changedFields.join(", ")}`);
  }
  if (input.version !== undefined) {
    parts.push(`Version: ${input.version}`);
  }
  if (input.comment) {
    parts.push(`Comment: ${input.comment}`);
  }
  return {
    id: input.id,
    timestamp: input.timestamp ?? Date.now(),
    actor: input.actor,
    action: "invoice_amended",
    category: "invoice",
    target: input.invoiceId,
    details: parts.join(" | "),
  };
}

export function appendInvoiceAmendmentAuditEntry(
  entries: AuditEntry[],
  input: InvoiceAmendmentAuditInput,
): AuditEntry[] {
  return [...entries, createInvoiceAmendmentAuditEntry(input)];
}

export function filterAuditEntriesByInvoice(
  entries: AuditEntry[],
  invoiceId: string,
): AuditEntry[] {
  return entries
    .filter((e) => e.category === "invoice" && e.target === invoiceId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function auditEntriesToCsv(entries: AuditEntry[]): string {
  const header = "timestamp,actor,category,action,target,details";
  const rows = entries.map((e) =>
    [new Date(e.timestamp).toISOString(), e.actor, e.category, e.action, e.target ?? "", e.details ?? ""]
      .map(csvCell)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

// ── Compliance & advanced audit extensions (issue #1016) ──────────────────

export type RetentionPolicy = '30d' | '90d' | '1y' | '7y' | 'forever';

export interface ComplianceReport {
  generatedAt: number;
  periodFrom: number;
  periodTo: number;
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  uniqueActors: number;
  retentionPolicy: RetentionPolicy;
  entries: AuditEntry[];
}

export interface AuditLogAnalytics {
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  byActor: Record<string, number>;
  actionsPerDay: Record<string, number>;   // ISO date → count
  mostActiveActor: string | null;
  mostCommonAction: string | null;
}

const RETENTION_MS: Record<RetentionPolicy, number> = {
  '30d':     30 * 24 * 60 * 60 * 1000,
  '90d':     90 * 24 * 60 * 60 * 1000,
  '1y':     365 * 24 * 60 * 60 * 1000,
  '7y':  7 * 365 * 24 * 60 * 60 * 1000,
  forever: Number.MAX_SAFE_INTEGER,
};

/** Enforce a retention policy, dropping entries older than the window. */
export function enforceRetentionPolicy(entries: AuditEntry[], policy: RetentionPolicy): AuditEntry[] {
  const cutoff = Date.now() - RETENTION_MS[policy];
  return entries.filter((e) => e.timestamp >= cutoff);
}

/** Generate a compliance report for a given period. */
export function generateComplianceReport(
  entries: AuditEntry[],
  periodFrom: number,
  periodTo: number,
  retentionPolicy: RetentionPolicy = '1y',
): ComplianceReport {
  const inPeriod = entries.filter((e) => e.timestamp >= periodFrom && e.timestamp <= periodTo);
  const byCategory = { invoice: 0, payment: 0, auth: 0, settings: 0, admin: 0 } as Record<AuditCategory, number>;
  for (const e of inPeriod) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  const uniqueActors = new Set(inPeriod.map((e) => e.actor)).size;
  return {
    generatedAt: Date.now(),
    periodFrom,
    periodTo,
    totalEvents: inPeriod.length,
    byCategory,
    uniqueActors,
    retentionPolicy,
    entries: inPeriod.sort((a, b) => b.timestamp - a.timestamp),
  };
}

/** Compute analytics over a set of audit entries. */
export function computeAuditAnalytics(entries: AuditEntry[]): AuditLogAnalytics {
  const byCategory = { invoice: 0, payment: 0, auth: 0, settings: 0, admin: 0 } as Record<AuditCategory, number>;
  const byActor: Record<string, number> = {};
  const actionsPerDay: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};

  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    byActor[e.actor] = (byActor[e.actor] ?? 0) + 1;
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    actionsPerDay[day] = (actionsPerDay[day] ?? 0) + 1;
    actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
  }

  const mostActiveActor = Object.keys(byActor).sort((a, b) => byActor[b] - byActor[a])[0] ?? null;
  const mostCommonAction = Object.keys(actionCounts).sort((a, b) => actionCounts[b] - actionCounts[a])[0] ?? null;

  return { totalEvents: entries.length, byCategory, byActor, actionsPerDay, mostActiveActor, mostCommonAction };
}

/** Full-text search across all entry fields. */
export function searchAuditEntries(entries: AuditEntry[], query: string): AuditEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    [e.actor, e.action, e.category, e.target, e.details]
      .some((f) => f?.toLowerCase().includes(q))
  );
}

/** Export entries as JSON string. */
export function auditEntriesToJson(entries: AuditEntry[]): string {
  return JSON.stringify(entries, null, 2);
}