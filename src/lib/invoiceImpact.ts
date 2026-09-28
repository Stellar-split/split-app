export interface ImpactInvoice {
  status: "pending" | "funded" | "released" | "expired" | "cancelled";
  target: number;
  raised: number;
  createdAt: string;
  fundedAt?: string;
  payers: number;
}

export interface ImpactMetrics {
  total: number;
  completionRate: number;
  fundingRatio: number;
  avgDaysToFund: number | null;
  totalRaised: number;
  avgPayers: number;
}

const DAY_MS = 86_400_000;

export function computeImpact(invoices: ImpactInvoice[]): ImpactMetrics {
  const total = invoices.length;
  if (total === 0) {
    return { total: 0, completionRate: 0, fundingRatio: 0, avgDaysToFund: null, totalRaised: 0, avgPayers: 0 };
  }
  const completed = invoices.filter((i) => i.status === "funded" || i.status === "released");
  const totalRaised = invoices.reduce((s, i) => s + i.raised, 0);
  const totalTarget = invoices.reduce((s, i) => s + i.target, 0);
  const durations = completed
    .filter((i) => i.fundedAt)
    .map((i) => (Date.parse(i.fundedAt!) - Date.parse(i.createdAt)) / DAY_MS);
  return {
    total,
    completionRate: completed.length / total,
    fundingRatio: totalTarget > 0 ? totalRaised / totalTarget : 0,
    avgDaysToFund: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    totalRaised,
    avgPayers: invoices.reduce((s, i) => s + i.payers, 0) / total,
  };
}
