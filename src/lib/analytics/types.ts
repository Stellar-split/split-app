// Analytics type definitions

export interface AnalyticsEvent {
  id: string;
  userId: string;
  name: string;
  timestamp: number;
  properties?: Record<string, unknown>;
}

/**
 * A custom dimension used to group users into cohorts or segments.
 * `key` refers to a property on the user profile or event properties.
 */
export interface CustomDimension {
  key: string;
  label?: string;
  /** Optional value extractor; defaults to reading `key` from the source record. */
  extract?: (record: Record<string, unknown>) => string | number | undefined;
}

/** A user record used as input to cohort and segmentation analysis. */
export interface AnalyticsUser {
  id: string;
  /** Timestamp (ms) of first acquisition / signup. */
  acquiredAt: number;
  properties?: Record<string, unknown>;
}

/** A cohort groups users sharing a common dimension value. */
export interface Cohort {
  id: string;
  /** Dimension key the cohort was grouped by (e.g. "acquisitionMonth"). */
  dimension: string;
  /** Value shared by all members of the cohort. */
  value: string;
  userIds: string[];
  size: number;
}

/** Per-period retention data for a cohort. */
export interface RetentionPoint {
  /** Period index (0 = acquisition period). */
  period: number;
  /** Number of users retained in this period. */
  retained: number;
  /** Retained / cohort size, in [0, 1]. */
  rate: number;
}

/** Retention analysis for a single cohort. */
export interface CohortRetention {
  cohortId: string;
  size: number;
  points: RetentionPoint[];
}

/** A behavior-based segment of users. */
export interface Segment {
  id: string;
  label: string;
  userIds: string[];
  size: number;
}

/** Rule used to assign users to a segment based on behavior. */
export interface SegmentRule {
  id: string;
  label: string;
  /** Returns true when the user matches the segment. */
  match: (user: AnalyticsUser, events: AnalyticsEvent[]) => boolean;
}

/** A single metric value for a cohort or segment. */
export interface MetricValue {
  metric: string;
  value: number;
}

/** Comparison report between two cohorts or segments. */
export interface ComparisonReport {
  leftId: string;
  rightId: string;
  metrics: Array<{
    metric: string;
    left: number;
    right: number;
    /** Absolute difference (right - left). */
    delta: number;
  }>;
}

/** Options controlling cohort analysis. */
export interface CohortAnalysisOptions {
  /** Dimension to group cohorts by. Defaults to acquisition period. */
  dimension?: CustomDimension;
  /** Number of retention periods to compute. */
  periods?: number;
  /** Length of each period in ms (defaults to one day). */
  periodMs?: number;
}

/** Full result of a cohort analysis run. */
export interface CohortAnalysisResult {
  cohorts: Cohort[];
  retention: CohortRetention[];
  segments: Segment[];
}
