export interface PastInvoice {
  id: string;
  title: string;
  amount: number;
  recipients: string[];
  createdAt: number;
}

export type RecommendationType = "recipient" | "amount" | "recurring";

export interface InvoiceRecommendation {
  id: string;
  type: RecommendationType;
  label: string;
  value: string;
  score: number;
}

const DAY_MS = 86_400_000;

export function recommendInvoices(history: PastInvoice[], limit = 5): InvoiceRecommendation[] {
  if (history.length === 0) return [];
  const recs: InvoiceRecommendation[] = [];

  const recipientCounts = new Map<string, number>();
  for (const inv of history) for (const r of inv.recipients) recipientCounts.set(r, (recipientCounts.get(r) ?? 0) + 1);
  recipientCounts.forEach((count, address) => {
    if (count >= 2) {
      recs.push({ id: `recipient-${address}`, type: "recipient", label: "Frequent recipient", value: address, score: count / history.length });
    }
  });

  const amounts = history.map((i) => i.amount).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const typical = amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  recs.push({ id: "amount-typical", type: "amount", label: "Typical amount", value: typical.toFixed(2), score: 0.5 });

  const byTitle = new Map<string, PastInvoice[]>();
  for (const inv of history) {
    const key = inv.title.trim().toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), inv]);
  }
  byTitle.forEach((list) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const avgGapDays = (sorted[sorted.length - 1].createdAt - sorted[0].createdAt) / (sorted.length - 1) / DAY_MS;
    recs.push({
      id: `recurring-${sorted[0].id}`,
      type: "recurring",
      label: `Recurring every ~${Math.max(1, Math.round(avgGapDays))} days`,
      value: sorted[sorted.length - 1].title,
      score: Math.min(1, list.length / history.length + 0.2),
    });
  });

  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}
