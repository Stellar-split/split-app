export interface PayerPayment {
  payer: string;
  invoiceId: string;
  amount: number;
  dueAt: string;
  paidAt: string | null;
}

export type PayerSegment = "reliable" | "slow" | "at-risk";

export interface PayerBehavior {
  payer: string;
  invoices: number;
  paid: number;
  totalPaid: number;
  onTimeRate: number;
  avgDelayDays: number;
  segment: PayerSegment;
}

const DAY_MS = 86_400_000;

export function segmentFor(onTimeRate: number, unpaidRate: number): PayerSegment {
  if (unpaidRate >= 0.5 || onTimeRate < 0.4) return "at-risk";
  if (onTimeRate < 0.8) return "slow";
  return "reliable";
}

export function analyzePayers(payments: PayerPayment[]): PayerBehavior[] {
  const groups = new Map<string, PayerPayment[]>();
  for (const p of payments) groups.set(p.payer, [...(groups.get(p.payer) ?? []), p]);

  return [...groups.entries()]
    .map(([payer, list]) => {
      const paidList = list.filter((p) => p.paidAt);
      const delays = paidList.map((p) => (Date.parse(p.paidAt!) - Date.parse(p.dueAt)) / DAY_MS);
      const onTime = delays.filter((d) => d <= 0).length;
      const onTimeRate = list.length ? onTime / list.length : 0;
      const unpaidRate = list.length ? (list.length - paidList.length) / list.length : 0;
      return {
        payer,
        invoices: list.length,
        paid: paidList.length,
        totalPaid: paidList.reduce((sum, p) => sum + p.amount, 0),
        onTimeRate,
        avgDelayDays: delays.length ? Math.max(0, delays.reduce((a, b) => a + b, 0) / delays.length) : 0,
        segment: segmentFor(onTimeRate, unpaidRate),
      };
    })
    .sort((a, b) => b.totalPaid - a.totalPaid);
}
