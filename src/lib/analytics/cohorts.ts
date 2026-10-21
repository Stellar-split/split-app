export interface AnalyticsEvent {
  userId: string;
  name: string;
  timestamp: number;
  properties?: Record<string, unknown>;
}

export interface CohortMember {
  userId: string;
  cohortKey: string;
  firstSeen: number;
  events: AnalyticsEvent[];
}

export interface Cohort {
  key: string;
  members: CohortMember[];
  size: number;
}

export interface RetentionPeriod {
  period: number;
  retained: number;
  rate: number;
}

export interface CohortRetention {
  cohortKey: string;
  size: number;
  periods: RetentionPeriod[];
}

export interface SegmentRule {
  name: string;
  predicate: (member: CohortMember) => boolean;
}

export interface Segment {
  name: string;
  members: CohortMember[];
  size: number;
}

export interface CohortComparison {
  cohortKey: string;
  size: number;
  retention: number[];
  averageEvents: number;
}

export interface ComparisonReport {
  periodCount: number;
  cohorts: CohortComparison[];
}

export type DimensionFn = (member: CohortMember) => string;

export interface CohortOptions {
  periodMs: number;
  dimension?: DimensionFn;
  periodCount?: number;
}

const DEFAULT_PERIOD_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PERIOD_COUNT = 8;

function periodIndex(timestamp: number, origin: number, periodMs: number): number {
  if (timestamp < origin) return -1;
  return Math.floor((timestamp - origin) / periodMs);
}

function defaultDimension(member: CohortMember, periodMs: number): string {
  const bucket = Math.floor(member.firstSeen / periodMs);
  return new Date(bucket * periodMs).toISOString().slice(0, 10);
}

/**
 * Groups events into cohort members keyed by user, using each user's first
 * event as their acquisition timestamp.
 */
export function buildMembers(events: AnalyticsEvent[]): CohortMember[] {
  const byUser = new Map<string, CohortMember>();
  for (const event of events) {
    const existing = byUser.get(event.userId);
    if (!existing) {
      byUser.set(event.userId, {
        userId: event.userId,
        cohortKey: '',
        firstSeen: event.timestamp,
        events: [event],
      });
      continue;
    }
    existing.events.push(event);
    if (event.timestamp < existing.firstSeen) {
      existing.firstSeen = event.timestamp;
    }
  }
  for (const member of byUser.values()) {
    member.events.sort((a, b) => a.timestamp - b.timestamp);
  }
  return Array.from(byUser.values());
}

/**
 * Cohort analysis engine: groups users into cohorts by acquisition period or a
 * custom dimension function.
 */
export function buildCohorts(events: AnalyticsEvent[], options: CohortOptions): Cohort[] {
  const periodMs = options.periodMs || DEFAULT_PERIOD_MS;
  const members = buildMembers(events);
  const cohorts = new Map<string, CohortMember[]>();

  for (const member of members) {
    const key = options.dimension
      ? options.dimension(member)
      : defaultDimension(member, periodMs);
    member.cohortKey = key;
    const bucket = cohorts.get(key);
    if (bucket) {
      bucket.push(member);
    } else {
      cohorts.set(key, [member]);
    }
  }

  return Array.from(cohorts.entries())
    .map(([key, cohortMembers]) => ({
      key,
      members: cohortMembers,
      size: cohortMembers.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Retention analysis: for each cohort, computes the share of members active in
 * each period after acquisition.
 */
export function computeRetention(
  cohort: Cohort,
  periodMs: number,
  periodCount: number = DEFAULT_PERIOD_COUNT,
): CohortRetention {
  const periods: RetentionPeriod[] = [];
  for (let period = 0; period < periodCount; period++) {
    let retained = 0;
    for (const member of cohort.members) {
      const active = member.events.some(
        (event) => periodIndex(event.timestamp, member.firstSeen, periodMs) === period,
      );
      if (active) retained++;
    }
    periods.push({
      period,
      retained,
      rate: cohort.size === 0 ? 0 : retained / cohort.size,
    });
  }
  return { cohortKey: cohort.key, size: cohort.size, periods };
}

/**
 * Segmentation: partitions members into named segments based on behavior
 * predicates. Members may belong to multiple segments.
 */
export function segmentMembers(members: CohortMember[], rules: SegmentRule[]): Segment[] {
  return rules.map((rule) => {
    const matched = members.filter((member) => rule.predicate(member));
    return { name: rule.name, members: matched, size: matched.length };
  });
}

/**
 * Comparison reports: summarizes retention and activity across cohorts so they
 * can be compared side by side.
 */
export function buildComparisonReport(
  cohorts: Cohort[],
  periodMs: number,
  periodCount: number = DEFAULT_PERIOD_COUNT,
): ComparisonReport {
  const comparisons: CohortComparison[] = cohorts.map((cohort) => {
    const retention = computeRetention(cohort, periodMs, periodCount);
    const totalEvents = cohort.members.reduce((sum, m) => sum + m.events.length, 0);
    return {
      cohortKey: cohort.key,
      size: cohort.size,
      retention: retention.periods.map((p) => p.rate),
      averageEvents: cohort.size === 0 ? 0 : totalEvents / cohort.size,
    };
  });
  return { periodCount, cohorts: comparisons };
}

/**
 * Convenience entry point combining cohort analysis, retention, and comparison
 * reporting for a raw event stream.
 */
export function analyzeCohorts(events: AnalyticsEvent[], options: CohortOptions) {
  const periodMs = options.periodMs || DEFAULT_PERIOD_MS;
  const periodCount = options.periodCount ?? DEFAULT_PERIOD_COUNT;
  const cohorts = buildCohorts(events, options);
  const retention = cohorts.map((cohort) => computeRetention(cohort, periodMs, periodCount));
  const report = buildComparisonReport(cohorts, periodMs, periodCount);
  return { cohorts, retention, report };
}
