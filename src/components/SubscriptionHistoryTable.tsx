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

/** Escapes a value for safe inclusion in a CSV cell. */
function escapeCSV(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds and triggers a CSV download for the given history rows. */
function downloadHistoryCSV(history: SubscriptionInvoice[]): void {
  const headers = ["Date", "Amount", "Currency", "Status", "Transaction Hash"];
  const rows = history.map((inv) => [
    new Date(inv.generatedAt * 1000).toISOString(),
    formatAmount(inv.amount),
    "USDC",
    inv.status,
    inv.invoiceId,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subscription-history-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
      {/* Export toolbar */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => downloadHistoryCSV(history)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-300 font-medium transition-colors"
          aria-label="Export subscription history as CSV"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Export CSV
        </button>
      </div>
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
