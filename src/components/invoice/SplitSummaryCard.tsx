"use client";

import type { Invoice } from "@stellar-split/sdk";
import { truncateAddress } from "@stellar-split/sdk";
import { formatXLM } from "@/lib/formatters";

function recipientPaid(invoice: Invoice, address: string) {
  return invoice.payments
    .filter((payment) => payment.payer === address)
    .reduce((sum, payment) => sum + payment.amount, 0n);
}

function paymentStatus(invoice: Invoice, address: string, amount: bigint) {
  const paid = recipientPaid(invoice, address);
  if (paid >= amount) return "Paid";
  if (paid > 0n) return "Partial";
  return "Unpaid";
}

export default function SplitSummaryCard({ invoice, total }: { invoice: Invoice; total: bigint }) {
  const tableTotal = invoice.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);

  return (
    <section className="mb-8 bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden" aria-labelledby="split-summary-heading">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 id="split-summary-heading" className="text-lg font-semibold text-white">
          Split Summary
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-2 font-medium">Recipient</th>
              <th className="text-right px-4 py-2 font-medium">Percentage</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {invoice.recipients.map((recipient) => {
              const percentage = total === 0n ? 0 : (Number(recipient.amount) / Number(total)) * 100;
              return (
                <tr key={recipient.address} className="hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-gray-300" title={recipient.address}>
                    {truncateAddress(recipient.address)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-200">{percentage.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right text-indigo-300">{formatXLM(recipient.amount)} XLM</td>
                  <td className="px-4 py-2 text-gray-200">{paymentStatus(invoice, recipient.address, recipient.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600 font-semibold text-gray-100">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">100.00%</td>
              <td className="px-4 py-2 text-right">{formatXLM(tableTotal)} XLM</td>
              <td className="px-4 py-2">{tableTotal === total ? "Matches invoice total" : "Does not match invoice total"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
