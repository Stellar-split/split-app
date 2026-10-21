export type CohortDimension = 'acquisitionPeriod' | 'custom';

export interface AnalyticsEvent {
  userId: string;
  timestamp: number;
  name: string;
  properties?: Record<string, unknown>;
}

export interface CohortMember {
  userId: string;
  cohortKey: string;
  firstSeen: number;
}

export interface Cohort {
  key: string;
  members: CohortMember[];
  size: number;
}

export interface RetentionRow {
  period: number;
  retained: number;
  rate: number;
}

export interface CohortMetrics {
  cohortKey: string;
  size: number;
  retention: RetentionRow[];
  activeUsers: number;
  totalEvents: number;
}

export interface SegmentRule {
  name: string;
  predicate: (events: AnalyticsEvent[]) => boolean;
}

export interface Segment {
  name: string;
  userIds: string[];
  size: number;
}

export interface ComparisonReport {
  left: string;
  right: string;
  metric: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  deltaRate: number;
}

export interface CohortAnalysisOptions {
  periodMs: number;
  periods: number;
  dimension?: CohortDimension;
  customDimension?: (event: AnalyticsEvent) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketStart(timestamp: number, periodMs: number): number {
  return Math.floor(timestamp / periodMs) * periodMs;
}

function resolveCohortKey(
  event: AnalyticsEvent,
  options: CohortAnalysisOptions,
): string {
  if (options.dimension === 'custom' && options.customDimension) {
    return options.customDimension(event);
  }
  return String(bucketStart(event.timestamp, options.periodMs));
}

function groupEventsByUser(
  events: AnalyticsEvent[],
): Map<string, AnalyticsEvent[]> {
  const byUser = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const list = byUser.get(event.userId);
    if (list) {
      list.push(event);
    } else {
      byUser.set(event.userId, [event]);
    }
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }
  return byUser;
}

/**
 * Groups users into cohorts based on their first-seen event, using either
 * acquisition period bucketing or a caller-supplied custom dimension.
 */
export function buildCohorts(
  events: AnalyticsEvent[],
  options: CohortAnalysisOptions,
): Cohort[] {
  const byUser = groupEventsByUser(events);
  const cohorts = new Map<string, CohortMember[]>();

  for (const [userId, userEvents] of byUser) {
    const first = userEvents[0];
    const key = resolveCohortKey(first, options);
    const member: CohortMember = {
      userId,
      cohortKey: key,
      firstSeen: first.timestamp,
    };
    const list = cohorts.get(key);
    if (list) {
      list.push(member);
    } else {
      cohorts.set(key, [member]);
    }
  }

  return Array.from(cohorts.entries())
    .map(([key, members]) => ({ key, members, size: members.length }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Computes period-over-period retention for a single cohort.
 */
export function computeRetention(
  cohort: Cohort,
  events: AnalyticsEvent[],
  options: CohortAnalysisOptions,
): RetentionRow[] {
  const memberIds = new Set(cohort.members.map((m) => m.userId));
  const firstSeenByUser = new Map(
    cohort.members.map((m) => [m.userId, m.firstSeen] as const),
  );
  const activeByPeriod = new Map<number, Set<string>>();

  for (const event of events) {
    if (!memberIds.has(event.userId)) continue;
    const firstSeen = firstSeenByUser.get(event.userId) ?? event.timestamp;
    const period = Math.floor(
      (event.timestamp - firstSeen) / options.periodMs,
    );
    if (period < 0 || period >= options.periods) continue;
    const set = activeByPeriod.get(period);
    if (set) {
      set.add(event.userId);
    } else {
      activeByPeriod.set(period, new Set([event.userId]));
    }
  }

  const rows: RetentionRow[] = [];
  for (let period = 0; period < options.periods; period++) {
    const retained = activeByPeriod.get(period)?.size ?? 0;
    rows.push({
      period,
      retained,
      rate: cohort.size === 0 ? 0 : retained / cohort.size,
    });
  }
  return rows;
}

/**
 * Computes per-cohort metrics including retention and activity totals.
 */
export function analyzeCohorts(
  events: AnalyticsEvent[],
  options: CohortAnalysisOptions,
): CohortMetrics[] {
  const cohorts = buildCohorts(events, options);
  return cohorts.map((cohort) => {
    const memberIds = new Set(cohort.members.map((m) => m.userId));
    const cohortEvents = events.filter((e) => memberIds.has(e.userId));
    const activeUsers = new Set(cohortEvents.map((e) => e.userId)).size;
    return {
      cohortKey: cohort.key,
      size: cohort.size,
      retention: computeRetention(cohort, events, options),
      activeUsers,
      totalEvents: cohortEvents.length,
    };
  });
}

/**
 * Segments users by evaluating behavior rules against each user's events.
 */
export function segmentUsers(
  events: AnalyticsEvent[],
  rules: SegmentRule[],
): Segment[] {
  const byUser = groupEventsByUser(events);
  return rules.map((rule) => {
    const userIds: string[] = [];
    for (const [userId, userEvents] of byUser) {
      if (rule.predicate(userEvents)) {
        userIds.push(userId);
      }
    }
    return { name: rule.name, userIds, size: userIds.length };
  });
}

/**
 * Builds a comparison report between two cohorts or segments on a metric.
 */
export function compareCohorts(
  left: { name: string; value: number },
  right: { name: string; value: number },
  metric: string,
): ComparisonReport {
  const delta = right.value - left.value;
  return {
    left: left.name,
    right: right.name,
    metric,
    leftValue: left.value,
    rightValue: right.value,
    delta,
    deltaRate: left.value === 0 ? 0 : delta / left.value,
  };
}

export const defaultPeriodMs = DAY_MS;
