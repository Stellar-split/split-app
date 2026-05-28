"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import InvoiceCard from "@/components/InvoiceCard";
import { SkeletonCard } from "@/components/Skeleton";
import type { Invoice } from "@stellar-split/sdk";

const ITEMS_PER_PAGE = 10;

/**
 * History page — shows all Released and Refunded invoices for the connected wallet.
 * Supports date range filtering and pagination.
 */
export default function HistoryPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view your history."),
      );
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchInvoices = async () => {
      setLoading(true);
      const results: Invoice[] = [];
      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const isCreator = inv.creator === publicKey;
          const isRecipient = inv.recipients.some(
            (r) => r.address === publicKey,
          );
          if ((isCreator || isRecipient) && 
              (inv.status === "Released" || inv.status === "Refunded")) {
            results.push(inv);
          }
        } catch {
          break;
        }
      }
      setInvoices(results);
      setLoading(false);
    };

    fetchInvoices().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, [publicKey]);

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    const fromTs = filterFromDate ? new Date(filterFromDate).getTime() / 1000 : 0;
    const toTs = filterToDate ? new Date(filterToDate).getTime() / 1000 : Infinity;

    return invoices.filter((inv) => {
      const invoiceDeadline = inv.deadline;
      return invoiceDeadline >= fromTs && invoiceDeadline <= toTs;
    });
  }, [invoices, filterFromDate, filterToDate]);

  // Calculate totals for filtered invoices
  const totals = useMemo(() => {
    let releasedTotal = 0n;
    let refundedTotal = 0n;

    filteredInvoices.forEach((inv) => {
      const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
      if (inv.status === "Released") {
        releasedTotal += total;
      } else if (inv.status === "Refunded") {
        refundedTotal += total;
      }
    });

    return { releasedTotal, refundedTotal };
  }, [filteredInvoices]);

  // Pagination
  const pageCount = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterFromDate, filterToDate]);

  if (error) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Invoice History</h1>
        <Link
          href="/dashboard"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Summary */}
      {!loading && filteredInvoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Released Total</p>
            <p className="text-2xl font-bold text-green-400">
              {formatAmount(totals.releasedTotal)} USDC
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Refunded Total</p>
            <p className="text-2xl font-bold text-gray-400">
              {formatAmount(totals.refundedTotal)} USDC
            </p>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-gray-900 rounded-lg p-4 mb-8 border border-gray-800">
        <label className="text-sm text-gray-400 mb-3 block font-semibold">
          Filter by Deadline
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label htmlFor="from-date" className="text-xs text-gray-500 mb-1">
              From
            </label>
            <input
              id="from-date"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="to-date" className="text-xs text-gray-500 mb-1">
              To
            </label>
            <input
              id="to-date"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        {(filterFromDate || filterToDate) && (
          <button
            onClick={() => {
              setFilterFromDate("");
              setFilterToDate("");
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Invoices */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <p className="text-gray-400 text-center py-12">
          {invoices.length === 0
            ? "No history yet. Completed invoices will appear here."
            : "No invoices match the selected filters."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-4 mb-8" aria-label="Invoice history list">
            {paginatedInvoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoice/${inv.id}`}
                  aria-label={`View Invoice #${inv.id}`}
                >
                  <InvoiceCard invoice={inv} />
                </Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {pageCount} ({filteredInvoices.length} invoices)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="min-h-10 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  className="min-h-10 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
