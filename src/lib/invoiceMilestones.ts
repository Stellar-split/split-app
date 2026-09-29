export const MILESTONE_PERCENTS = [25, 50, 75, 100] as const;

export interface InvoiceMilestone {
  percent: number;
  label: string;
  reached: boolean;
}

export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (raised / target) * 100));
}

export function milestonesFor(raised: number, target: number): InvoiceMilestone[] {
  const pct = fundedPercent(raised, target);
  return MILESTONE_PERCENTS.map((percent) => ({
    percent,
    label: percent === 100 ? "Fully funded" : `${percent}% funded`,
    reached: pct >= percent,
  }));
}

export function newestMilestone(raised: number, target: number): InvoiceMilestone | null {
  const reached = milestonesFor(raised, target).filter((m) => m.reached);
  return reached.length ? reached[reached.length - 1] : null;
}
