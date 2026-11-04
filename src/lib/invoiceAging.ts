export type AgingBucketKey = "current" | "1-30" | "31-60" | "61-90" | "90+";

export const AGING_BUCKETS = {
  current: { label: "Current", color: "green" },
  "1-30": { label: "1-30 days", color: "yellow" },
  "31-60": { label: "31-60 days", color: "orange" },
  "61-90": { label: "61-90 days", color: "red" },
  "90+": { label: "90+ days", color: "darkred" }
};

export function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export function getDaysOverdue(deadline: number): number {
  const now = Math.floor(Date.now() / 1000);
  const overdue = now - deadline;
  return Math.max(0, Math.ceil(overdue / 86400));
}
