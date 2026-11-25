/**
 * Compliance Audit Log (#1171)
 *
 * Logs compliance events, tracks user actions, supports filtering, and generates reports.
 */

export type ComplianceEventCategory =
  | 'data_access'
  | 'data_modification'
  | 'authentication'
  | 'authorization'
  | 'payment'
  | 'export'
  | 'admin'
  | 'consent';

export type ComplianceSeverity = 'info' | 'warning' | 'critical';

export interface ComplianceEvent {
  id: string;
  timestamp: number;
  category: ComplianceEventCategory;
  severity: ComplianceSeverity;
  actor: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ComplianceFilter {
  category?: ComplianceEventCategory;
  severity?: ComplianceSeverity;
  actor?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  searchQuery?: string;
}

export interface ComplianceReport {
  generatedAt: number;
  periodFrom: number;
  periodTo: number;
  totalEvents: number;
  byCategory: Record<ComplianceEventCategory, number>;
  bySeverity: Record<ComplianceSeverity, number>;
  uniqueActors: number;
  topActors: Array<{ actor: string; count: number }>;
  events: ComplianceEvent[];
}

// ─── In-memory log ────────────────────────────────────────────────────────────

const log: ComplianceEvent[] = [];
let _idCounter = 0;

function generateId(): string {
  return `compliance-${Date.now()}-${++_idCounter}`;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/** Log a compliance event. */
export function logComplianceEvent(
  event: Omit<ComplianceEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
): ComplianceEvent {
  const entry: ComplianceEvent = {
    id: event.id ?? generateId(),
    timestamp: event.timestamp ?? Date.now(),
    category: event.category,
    severity: event.severity,
    actor: event.actor,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    details: event.details,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
  };
  log.push(entry);
  return entry;
}

/** Get all logged events. */
export function getAllEvents(): ComplianceEvent[] {
  return [...log];
}

/** Get event by ID. */
export function getEventById(id: string): ComplianceEvent | undefined {
  return log.find((e) => e.id === id);
}

/** Clear all events (for testing). */
export function clearComplianceLog(): void {
  log.length = 0;
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/** Filter events by criteria. */
export function filterEvents(filter: ComplianceFilter = {}): ComplianceEvent[] {
  return log.filter((event) => {
    if (filter.category && event.category !== filter.category) return false;
    if (filter.severity && event.severity !== filter.severity) return false;
    if (filter.actor && event.actor !== filter.actor) return false;
    if (filter.fromTimestamp !== undefined && event.timestamp < filter.fromTimestamp) return false;
    if (filter.toTimestamp !== undefined && event.timestamp > filter.toTimestamp) return false;
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const searchable = [event.actor, event.action, event.resourceType, event.resourceId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function emptyByCategory(): Record<ComplianceEventCategory, number> {
  return {
    data_access: 0,
    data_modification: 0,
    authentication: 0,
    authorization: 0,
    payment: 0,
    export: 0,
    admin: 0,
    consent: 0,
  };
}

function emptyBySeverity(): Record<ComplianceSeverity, number> {
  return { info: 0, warning: 0, critical: 0 };
}

/** Generate a compliance report for a time period. */
export function generateReport(
  periodFrom: number,
  periodTo: number,
): ComplianceReport {
  const events = log.filter((e) => e.timestamp >= periodFrom && e.timestamp <= periodTo);
  const byCategory = emptyByCategory();
  const bySeverity = emptyBySeverity();
  const actorCounts: Record<string, number> = {};

  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    actorCounts[e.actor] = (actorCounts[e.actor] ?? 0) + 1;
  }

  const topActors = Object.entries(actorCounts)
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    generatedAt: Date.now(),
    periodFrom,
    periodTo,
    totalEvents: events.length,
    byCategory,
    bySeverity,
    uniqueActors: Object.keys(actorCounts).length,
    topActors,
    events: events.sort((a, b) => b.timestamp - a.timestamp),
  };
}

function csvCell(val: string): string {
  return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
}

/** Export events as CSV. */
export function exportToCsv(events: ComplianceEvent[]): string {
  const header = 'id,timestamp,category,severity,actor,action,resourceType,resourceId';
  const rows = events.map((e) =>
    [
      e.id,
      new Date(e.timestamp).toISOString(),
      e.category,
      e.severity,
      e.actor,
      e.action,
      e.resourceType ?? '',
      e.resourceId ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** Export events as JSON. */
export function exportToJson(events: ComplianceEvent[]): string {
  return JSON.stringify(events, null, 2);
}
