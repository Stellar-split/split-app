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
