"use client";

import { useEffect } from "react";
import { truncateAddress } from "@stellar-split/sdk";
import { useInvoiceHistory } from "@/hooks/useInvoiceHistory";
import AmountDisplay from "@/components/invoice/AmountDisplay";

interface Props {
  invoiceId: string;
}

export default function InvoiceHistoryTable({ invoiceId }: Props) {
  const {
    payments,
    pageNumber,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    loadFirstPage,
    loading,
  } = useInvoiceHistory(invoiceId);

  useEffect(() => {
    loadFirstPage();
  }, [invoiceId, loadFirstPage]);

  if (loading && payments.length === 0) {
    return (
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 text-center">
        <p className="text-gray-400">Loading payment history...</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 text-center">
        <p className="text-gray-400">No payments yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Payer</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {payments.map((payment, i) => (
              <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-300 truncate max-w-[200px]" title={payment.payer}>
                  {truncateAddress(payment.payer)}
                </td>
                <td className="px-4 py-3 text-right text-indigo-300 font-medium">
                  <AmountDisplay amount={payment.amount} inline />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={!hasPreviousPage || loading}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          Previous
        </button>

        <span className="text-sm text-gray-400 font-medium">
          Page {pageNumber}
        </span>

        <button
          type="button"
          onClick={goToNextPage}
          disabled={!hasNextPage || loading}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
