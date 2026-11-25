/** Funding milestones (percent) that trigger a push notification, in order. */
export const FUNDING_MILESTONES = [25, 50, 75, 100] as const;

export type FundingMilestone = (typeof FUNDING_MILESTONES)[number];

/** Percent funded, 0–100, clamped. `total` of 0 is treated as 0% funded. */
export function fundedPercent(funded: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  const pct = Number((funded * 10_000n) / total) / 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Milestones newly crossed by the current funded percentage that haven't
 * already been notified, in ascending order.
 */
export function crossedMilestones(
  currentPct: number,
  alreadyNotified: Iterable<number>
): FundingMilestone[] {
  const notified = new Set(alreadyNotified);
  return FUNDING_MILESTONES.filter((m) => currentPct >= m && !notified.has(m));
}
