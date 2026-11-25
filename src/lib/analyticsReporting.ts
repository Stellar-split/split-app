/**
 * Analytics Reporting Library (#1170)
 *
 * Provides report generation, filtering, and export for analytics events.
 */

export interface ReportEvent {
  id: string;
  userId: string;
  eventType: string;
  timestamp: number;
  value?: number;
  metadata?: Record<string, unknown>;
}

export interface ReportFilter {
  fromTimestamp?: number;
  toTimestamp?: number;
  eventType?: string;
  userId?: string;
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  byEventType: Record<string, number>;
  byDate: Record<string, number>; // ISO date → count
  totalValue: number;
  avgValue: number;
}

export interface AnalyticsReport {
  generatedAt: number;
  filter: ReportFilter;
  summary: AnalyticsSummary;
  events: ReportEvent[];
}

/** Filter events by criteria. */
export function filterReportEvents(events: ReportEvent[], filter: ReportFilter = {}): ReportEvent[] {
  return events.filter((e) => {
    if (filter.fromTimestamp !== undefined && e.timestamp < filter.fromTimestamp) return false;
    if (filter.toTimestamp !== undefined && e.timestamp > filter.toTimestamp) return false;
    if (filter.eventType && e.eventType !== filter.eventType) return false;
    if (filter.userId && e.userId !== filter.userId) return false;
    return true;
  });
}

/** Compute summary statistics for a set of events. */
export function computeSummary(events: ReportEvent[]): AnalyticsSummary {
  const byEventType: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const userSet = new Set<string>();
  let totalValue = 0;
  let valueCount = 0;

  for (const e of events) {
    byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + 1;
    const date = new Date(e.timestamp).toISOString().slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + 1;
    userSet.add(e.userId);
    if (e.value !== undefined) {
      totalValue += e.value;
      valueCount++;
    }
  }

  return {
    totalEvents: events.length,
    uniqueUsers: userSet.size,
    byEventType,
    byDate,
    totalValue,
    avgValue: valueCount > 0 ? totalValue / valueCount : 0,
  };
}

/** Generate a full analytics report. */
export function generateAnalyticsReport(
  events: ReportEvent[],
  filter: ReportFilter = {},
): AnalyticsReport {
  const filtered = filterReportEvents(events, filter);
  return {
    generatedAt: Date.now(),
    filter,
    summary: computeSummary(filtered),
    events: filtered,
  };
}

function csvCell(val: string): string {
  return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
}

/** Export events as CSV. */
export function exportReportToCsv(events: ReportEvent[]): string {
  const header = 'id,userId,eventType,timestamp,value';
  const rows = events.map((e) =>
    [e.id, e.userId, e.eventType, new Date(e.timestamp).toISOString(), e.value ?? '']
      .map(String)
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** Export events as JSON. */
export function exportReportToJson(events: ReportEvent[]): string {
  return JSON.stringify(events, null, 2);
}
