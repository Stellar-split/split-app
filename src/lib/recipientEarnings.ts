export interface EarningRecord {
  invoiceId: string;
  amount: number;
  asset: string;
  paidAt: string;
}

export interface EarningsSummary {
  total: number;
  count: number;
  average: number;
  byAsset: Record<string, number>;
  byMonth: { month: string; total: number }[];
}

export function summarizeEarnings(records: EarningRecord[]): EarningsSummary {
  const byAsset: Record<string, number> = {};
  const months = new Map<string, number>();
  let total = 0;
  for (const r of records) {
    total += r.amount;
    byAsset[r.asset] = (byAsset[r.asset] ?? 0) + r.amount;
    const month = r.paidAt.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + r.amount);
  }
  const byMonth = Array.from(months, ([month, t]) => ({ month, total: t })).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  return { total, count: records.length, average: records.length ? total / records.length : 0, byAsset, byMonth };
}
