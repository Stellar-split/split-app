/**
 * Get a relative time string (e.g., "3 days ago", "in 2 hours")
 * For ages > 30 days, returns an absolute date in the user's locale.
 */
export function getRelativeAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  // Use Intl.RelativeTimeFormat for relative times
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (diffSec < 60) {
    return "just now";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return rtf.format(-diffHour, "hour");
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) {
    return rtf.format(-diffDay, "day");
  }

  // For ages > 30 days, show absolute date in user's locale
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Supported recurring schedule frequencies.
 */
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "custom";

/**
 * A recurring schedule definition.
 * - `frequency`: the base cadence of the schedule.
 * - `interval`: multiplier applied to the frequency (e.g. every 2 weeks).
 *   For "custom" schedules, `interval` is interpreted as a number of days.
 * - `startDate`: the anchor date from which runs are computed.
 * - `endDate`: optional inclusive end date after which no runs occur.
 */
export interface RecurrenceSchedule {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endDate?: Date;
}

/**
 * Add a number of days to a date, returning a new Date.
 * Does not mutate the input.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add a number of months to a date, returning a new Date.
 * Handles month-end overflow by clamping to the last valid day of the
 * target month (e.g. Jan 31 + 1 month => Feb 28/29).
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(targetDay, lastDayOfMonth));
  return result;
}

/**
 * Add an interval to a date based on a frequency.
 * - daily: adds `interval` days
 * - weekly: adds `interval * 7` days
 * - monthly: adds `interval` months
 * - custom: adds `interval` days
 */
export function addInterval(
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number,
): Date {
  const safeInterval = Math.max(1, Math.floor(interval));
  switch (frequency) {
    case "daily":
      return addDays(date, safeInterval);
    case "weekly":
      return addDays(date, safeInterval * 7);
    case "monthly":
      return addMonths(date, safeInterval);
    case "custom":
    default:
      return addDays(date, safeInterval);
  }
}

/**
 * Determine whether two dates fall on the same calendar day (local time).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Compute the next run date for a schedule at or after `from`.
 *
 * If `from` is before the schedule's start date, the start date is returned.
 * If the schedule has an end date and the next run would fall after it,
 * `null` is returned. The returned date preserves the time-of-day of the
 * schedule's start date.
 */
export function computeNextRun(
  frequency: RecurrenceFrequency,
  interval: number,
  from: Date,
  startDate?: Date,
  endDate?: Date,
): Date | null {
  const anchor = startDate ?? from;
  const safeInterval = Math.max(1, Math.floor(interval));

  // If we haven't reached the start yet, the next run is the start.
  if (from.getTime() <= anchor.getTime()) {
    if (endDate && anchor.getTime() > endDate.getTime()) {
      return null;
    }
    return new Date(anchor.getTime());
  }

  // Walk forward from the anchor until we pass `from`.
  let candidate = new Date(anchor.getTime());
  // Guard against pathological loops.
  const maxIterations = 100000;
  let iterations = 0;
  while (candidate.getTime() <= from.getTime()) {
    candidate = addInterval(candidate, frequency, safeInterval);
    iterations += 1;
    if (iterations > maxIterations) {
      return null;
    }
  }

  if (endDate && candidate.getTime() > endDate.getTime()) {
    return null;
  }

  return candidate;
}

/**
 * Compute the next `count` run dates for a schedule starting at or after
 * `from`. Stops early if the schedule's end date is reached.
 */
export function computeNextRuns(
  frequency: RecurrenceFrequency,
  interval: number,
  from: Date,
  count: number,
  startDate?: Date,
  endDate?: Date,
): Date[] {
  const runs: Date[] = [];
  let cursor = new Date(from.getTime());
  for (let i = 0; i < count; i += 1) {
    const next = computeNextRun(
      frequency,
      interval,
      cursor,
      startDate,
      endDate,
    );
    if (!next) {
      break;
    }
    runs.push(next);
    // Advance cursor just past the run to avoid returning it again.
    cursor = new Date(next.getTime() + 1);
  }
  return runs;
}

/**
 * A time window used for overlap detection.
 */
export interface ScheduleWindow {
  start: Date;
  end: Date;
}

/**
 * Determine whether two schedule windows overlap.
 * Windows are treated as inclusive of their start and end instants.
 * Returns false for invalid windows (end before start).
 */
export function windowsOverlap(a: ScheduleWindow, b: ScheduleWindow): boolean {
  if (a.end.getTime() < a.start.getTime()) return false;
  if (b.end.getTime() < b.start.getTime()) return false;
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

/**
 * Detect whether a candidate window conflicts with any existing windows.
 * Returns the first conflicting window, or `null` if there is no conflict.
 */
export function findOverlappingWindow(
  candidate: ScheduleWindow,
  existing: ScheduleWindow[],
): ScheduleWindow | null {
  for (const window of existing) {
    if (windowsOverlap(candidate, window)) {
      return window;
    }
  }
  return null;
}

/**
 * Detect whether a candidate window conflicts with any existing windows.
 * Convenience boolean wrapper around `findOverlappingWindow`.
 */
export function hasScheduleConflict(
  candidate: ScheduleWindow,
  existing: ScheduleWindow[],
): boolean {
  return findOverlappingWindow(candidate, existing) !== null;
}