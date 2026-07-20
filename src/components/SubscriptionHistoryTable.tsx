"use client";

import type { SubscriptionInvoice } from "@/types/subscription";
import { formatAmount } from "@stellar-split/sdk";

interface Props {
  history: SubscriptionInvoice[];
}

const STATUS_STYLES: Record<string, string> = {
  Pending: "text-yellow-400",
  Released: "text-green-400",
  Refunded: "text-gray-400",
};

export default function SubscriptionHistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        No invoices generated yet.
      </p>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">
                Invoice ID
              </th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">
                Generated
              </th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">
                Deadline
              </th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">
                Amount
              </th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((inv) => (
              <tr
                key={inv.invoiceId}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="py-2.5 px-3 text-gray-300">#{inv.invoiceId}</td>
                <td className="py-2.5 px-3 text-gray-400">
                  {new Date(inv.generatedAt * 1000).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-3 text-gray-400">
                  {new Date(inv.deadline * 1000).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-300">
                  {formatAmount(inv.amount)} USDC
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-medium ${STATUS_STYLES[inv.status]}`}
                >
                  {inv.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {history.map((inv) => (
          <div
            key={inv.invoiceId}
            className="bg-gray-800/50 rounded-lg p-3 border border-gray-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-medium">#{inv.invoiceId}</span>
              <span className={`text-sm font-medium ${STATUS_STYLES[inv.status]}`}>
                {inv.status}
              </span>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p>Generated: {new Date(inv.generatedAt * 1000).toLocaleDateString()}</p>
              <p>Deadline: {new Date(inv.deadline * 1000).toLocaleDateString()}</p>
              <p className="text-gray-300">
                Amount: {formatAmount(inv.amount)} USDC
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
