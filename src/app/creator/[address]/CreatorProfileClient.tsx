"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import StatusBadge from "@/components/StatusBadge";
import FundingProgress from "@/components/FundingProgress";
import type { InvoiceStatus } from "@stellar-split/sdk";

interface PublicInvoice {
  id: string;
  status: InvoiceStatus;
  total: bigint;
  funded: bigint;
  deadline: number;
}

interface Props {
  address: string;
  totalInvoices: number;
  totalVolume: string;
  completionRate: number;
  invoices: PublicInvoice[];
}

export default function CreatorProfileClient({
  address,
  totalInvoices,
  totalVolume,
  completionRate,
  invoices,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${truncateAddress(address)} on StellarSplit`, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const now = Math.floor(Date.now() / 1000);

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-mono break-all">
            <span className="sm:hidden">{truncateAddress(address)}</span>
            <span className="hidden sm:inline">{address}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Creator Profile</p>
        </div>
        <button
          onClick={handleShare}
          className="shrink-0 min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Stats */}
      <section aria-labelledby="creator-stats-heading" className="mb-8">
        <h2 id="creator-stats-heading" className="sr-only">Creator stats</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Invoices", value: String(totalInvoices) },
            { label: "Total Raised", value: `${totalVolume} USDC` },
            { label: "Completion Rate", value: `${completionRate}%` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-gray-900 rounded-xl px-4 py-4 text-center"
            >
              <p className="text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Invoice list */}
      <section aria-labelledby="creator-invoices-heading">
        <h2 id="creator-invoices-heading" className="text-lg font-semibold mb-3">
          Public Invoices ({invoices.length})
        </h2>

        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No public invoices yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invoices.map((inv) => {
              const pct =
                inv.total > 0n
                  ? Math.min(100, Number((inv.funded * 100n) / inv.total))
                  : 0;
              const isActive =
                inv.status === "Pending" && inv.deadline > now;

              return (
                <li
                  key={inv.id}
                  className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-gray-300">
                        Invoice #{inv.id}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatAmount(inv.funded)} / {formatAmount(inv.total)} USDC
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>

                  <FundingProgress funded={inv.funded} total={inv.total} />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      {pct.toFixed(1)}% funded
                    </span>
                    {isActive ? (
                      <Link
                        href={`/invoice/${inv.id}`}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold transition-colors"
                      >
                        Pay
                      </Link>
                    ) : (
                      <Link
                        href={`/invoice/${inv.id}`}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-semibold transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
