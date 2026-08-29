"use client";

import Link from "next/link";
import { formatAmount, type Invoice } from "@stellar-split/sdk";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_CONFIG } from "@/lib/invoiceStatus";
import AmountDisplay from "./AmountDisplay";

interface Props {
  invoice: Invoice;
  total: bigint;
  publicKey: string | null;
}

/**
 * InvoiceSummaryPanel — sticky sidebar showing totals, funded amount, and status.
 * Remains visible while scrolling through the recipient list on lg+ screens.
 * On mobile, displays below the recipient list without sticky behavior.
 */
export default function InvoiceSummaryPanel({ invoice, total, publicKey }: Props) {
  const remaining = total - invoice.funded;
  const fundedPercent = total > 0n ? Number((invoice.funded * 100n) / total) : 0;

  const canPay =
    invoice.status === "Pending" && publicKey && publicKey !== invoice.creator;
  const canRelease =
    (invoice.status as string) === "Funded" && publicKey === invoice.creator;
  const canRefund =
    invoice.status === "Released" && publicKey === invoice.creator;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-2">
          Status
        </h2>
        <StatusBadge status={invoice.status as any} size="md" />
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-2">
          Total Amount
        </h3>
        <div className="text-3xl font-bold text-white">
          <AmountDisplay amount={total} />
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-2">
          Funded
        </h3>
        <div className="text-2xl font-bold text-green-400">
          <AmountDisplay amount={invoice.funded} />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {fundedPercent.toFixed(1)}% of total
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-2">
          Remaining
        </h3>
        <div className="text-2xl font-bold text-yellow-400">
          <AmountDisplay amount={remaining} />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-800">
        {canPay && (
          <Link
            href={`/invoice/${invoice.id}#pay-heading`}
            className="block min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-center transition-colors"
          >
            Pay Toward Invoice
          </Link>
        )}
        {canRelease && (
          <button
            disabled
            className="block w-full min-h-11 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
          >
            Release Funds
          </button>
        )}
        {canRefund && (
          <button
            disabled
            className="block w-full min-h-11 px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
          >
            Refund
          </button>
        )}
        {!canPay && !canRelease && !canRefund && (
          <p className="text-sm text-gray-400 text-center py-2">
            No actions available for this invoice
          </p>
        )}
      </div>
    </div>
  );
}
