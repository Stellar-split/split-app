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
