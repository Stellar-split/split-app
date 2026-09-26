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
  reputationScore?: number;
  invoices: PublicInvoice[];
}

const PAGE_SIZE = 5;

export default function CreatorProfileClient({
  address,
  totalInvoices,
  totalVolume,
  completionRate,
  reputationScore = 50,
  invoices,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getReputationTier = (score: number) => {
    if (score >= 80) return { label: "Verified & Highly Trusted", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" };
    if (score >= 50) return { label: "Established Creator", color: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10" };
    return { label: "Emerging Creator", color: "text-amber-400 border-amber-500/40 bg-amber-500/10" };
  };

  const tier = getReputationTier(reputationScore);

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono break-all text-white">
              <span className="sm:hidden">{truncateAddress(address)}</span>
              <span className="hidden sm:inline">{address}</span>
            </h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${tier.color}`}>
              {tier.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">Public Creator Profile</p>
        </div>
        <button
          onClick={handleShare}
          className="shrink-0 min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Stats Grid including On-Chain Reputation Score */}
      <section aria-labelledby="creator-stats-heading" className="mb-8">
        <h2 id="creator-stats-heading" className="sr-only">Creator stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-indigo-400 truncate">
              {reputationScore}<span className="text-sm font-normal text-gray-500">/100</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Reputation Score</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{totalInvoices}</p>
            <p className="text-xs text-gray-400 mt-1">Total Invoices</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{totalVolume} USDC</p>
            <p className="text-xs text-gray-400 mt-1">Total Raised</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{completionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">Completion Rate</p>
          </div>
        </div>
      </section>

      {/* Paginated Invoice list */}
      <section aria-labelledby="creator-invoices-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="creator-invoices-heading" className="text-lg font-semibold text-white">
            Public Invoices ({invoices.length})
          </h2>
          {invoices.length > 0 && (
            <span className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>

        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm bg-gray-900/40 border border-gray-800 rounded-xl p-6 text-center">
            No public invoices yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {paginatedInvoices.map((inv) => {
                const pct =
                  inv.total > 0n
                    ? Math.min(100, Number((inv.funded * 100n) / inv.total))
                    : 0;
                const isActive =
                  inv.status === "Pending" && inv.deadline > now;

                return (
                  <li
                    key={inv.id}
                    className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3 border border-gray-800"
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

                    <FundingProgress funded={inv.funded} total={inv.total} token="USDC" />

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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl border border-gray-800 mt-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, invoices.length)} of {invoices.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
