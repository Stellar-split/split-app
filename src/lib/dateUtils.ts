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
