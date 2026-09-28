"use client";

import { formatAmount, type Invoice } from "@stellar-split/sdk";

export interface ReconciliationReport {
  target: bigint;
  funded: bigint;
  paymentsTotal: bigint;
  /** Difference between on-chain `funded` and the sum of recorded payments. */
  ledgerDiscrepancy: bigint;
  outstanding: bigint;
  overpaid: bigint;
  balanced: boolean;
  issues: string[];
}

/** Cross-checks invoice totals: recipient targets, funded amount and recorded payments. */
export function reconcileInvoice(invoice: Invoice): ReconciliationReport {
  const target = invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);
  const paymentsTotal = invoice.payments.reduce((sum, p) => sum + p.amount, 0n);
  const funded = invoice.funded;
  const ledgerDiscrepancy = funded - paymentsTotal;
  const outstanding = target > funded ? target - funded : 0n;
  const overpaid = funded > target ? funded - target : 0n;
  const issues: string[] = [];

  if (ledgerDiscrepancy !== 0n) issues.push("Funded amount does not match the sum of recorded payments");
  if (overpaid > 0n) issues.push("Invoice is overpaid");
  if (invoice.status === "Released" && outstanding > 0n) issues.push("Released with an outstanding balance");
  if (invoice.payments.some((p) => p.amount <= 0n)) issues.push("Contains zero or negative payments");

  return {
    target,
    funded,
    paymentsTotal,
    ledgerDiscrepancy,
    outstanding,
    overpaid,
    balanced: issues.length === 0,
    issues,
  };
}

export default function ReconciliationPanel({ invoice }: { invoice: Invoice }) {
  const r = reconcileInvoice(invoice);
  const rows: [string, bigint][] = [
    ["Target", r.target],
    ["Funded (on-chain)", r.funded],
    ["Recorded payments", r.paymentsTotal],
    ["Outstanding", r.outstanding],
    ["Ledger discrepancy", r.ledgerDiscrepancy],
  ];

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6" aria-labelledby="reconciliation-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="reconciliation-heading" className="text-lg font-semibold text-white">
          Reconciliation
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            r.balanced ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
          }`}
          data-testid="reconciliation-status"
        >
          {r.balanced ? "Balanced" : `${r.issues.length} issue${r.issues.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-gray-900/50 p-3">
            <dt className="text-xs text-gray-400">{label}</dt>
            <dd className="font-mono text-sm text-white">{formatAmount(value)}</dd>
          </div>
        ))}
      </dl>
      {r.issues.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-red-300">
          {r.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
