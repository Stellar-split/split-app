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
 * Format a date relative to a reference point (defaults to now).
 * Returns human-readable strings like "just now", "2 minutes ago", "3 days ago", "in 5 hours",
 * capped at "over a year ago" / "over a year from now" for distant dates.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const referenceTime = now instanceof Date ? now.getTime() : new Date().getTime();
  const targetTime = date instanceof Date ? date.getTime() : new Date(date).getTime();

  if (isNaN(referenceTime) || isNaN(targetTime)) {
    return "";
  }

  const diffMs = referenceTime - targetTime;
  const absDiffMs = Math.abs(diffMs);
  const isPast = diffMs >= 0;

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  if (absDiffMs < 60 * SECOND) {
    return "just now";
  }

  if (absDiffMs < HOUR) {
    const minutes = Math.floor(absDiffMs / MINUTE);
    return isPast
      ? `${minutes} minute${minutes === 1 ? "" : "s"} ago`
      : `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  if (absDiffMs < DAY) {
    const hours = Math.floor(absDiffMs / HOUR);
    return isPast
      ? `${hours} hour${hours === 1 ? "" : "s"} ago`
      : `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (absDiffMs < WEEK) {
    const days = Math.floor(absDiffMs / DAY);
    return isPast
      ? `${days} day${days === 1 ? "" : "s"} ago`
      : `in ${days} day${days === 1 ? "" : "s"}`;
  }

  if (absDiffMs < MONTH) {
    const weeks = Math.floor(absDiffMs / WEEK);
    return isPast
      ? `${weeks} week${weeks === 1 ? "" : "s"} ago`
      : `in ${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  if (absDiffMs < YEAR) {
    const months = Math.floor(absDiffMs / MONTH);
    const safeMonths = Math.max(1, months);
    if (safeMonths >= 12) {
      return isPast ? "over a year ago" : "over a year from now";
    }
    return isPast
      ? `${safeMonths} month${safeMonths === 1 ? "" : "s"} ago`
      : `in ${safeMonths} month${safeMonths === 1 ? "" : "s"}`;
  }

  return isPast ? "over a year ago" : "over a year from now";
}
