import { computeImpact, type ImpactInvoice } from "@/lib/invoiceImpact";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function InvoiceImpactPanel({ invoices }: { invoices: ImpactInvoice[] }) {
  const m = computeImpact(invoices);
  const stats: [string, string][] = [
    ["Invoices", String(m.total)],
    ["Completion rate", pct(m.completionRate)],
    ["Funding ratio", pct(m.fundingRatio)],
    ["Avg. days to fund", m.avgDaysToFund === null ? "—" : m.avgDaysToFund.toFixed(1)],
    ["Total raised", m.totalRaised.toFixed(2)],
    ["Avg. payers", m.avgPayers.toFixed(1)],
  ];
  return (
    <section aria-label="Invoice impact">
      <h2 className="mb-3 text-lg font-semibold">Impact</h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded border p-3">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
