"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice, Payment } from "@stellar-split/sdk";
import { SkeletonPaymentRow } from "@/components/Skeleton";

const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet/tx";
const ITEMS_PER_PAGE = 20;
const MAX_INVOICES = 100;

interface PaymentRow {
  invoiceId: string;
  invoiceTitle: string;
  date: number;
  amountPaid: bigint;
  tipAmount: bigint;
  txHash: string;
}

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

function buildRows(invoices: Invoice[], walletAddress: string): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const inv of invoices) {
    for (const p of inv.payments) {
      if (p.payer !== walletAddress) continue;
      rows.push({
        invoiceId: inv.id,
        invoiceTitle: `Invoice #${inv.id}`,
        date: inv.deadline,
        amountPaid: p.amount,
        tipAmount: 0n,
        txHash: "",
      });
    }
  }
  return rows;
}

function csvLine(row: PaymentRow): string {
  return [
    new Date(row.date * 1000).toISOString(),
    `"${row.invoiceTitle}"`,
    formatAmount(row.amountPaid),
    formatAmount(row.tipAmount),
    row.txHash,
  ].join(",");
}

function downloadCsv(rows: PaymentRow[]) {
  const header = "Date,Invoice,Amount Paid (XLM),Tip Amount (XLM),Tx Hash";
  const body = rows.map(csvLine).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payment-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** /payments — chronological log of all payments made by the connected wallet */
export default function PaymentsPage() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    if (!publicKey) return;

    const load = async () => {
      setLoading(true);
      const invoices: Invoice[] = [];
      for (let id = 1; id <= MAX_INVOICES; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const paid = inv.payments.some((p: Payment) => p.payer === publicKey);
          if (paid) invoices.push(inv);
        } catch {
          break;
        }
      }
      setRows(buildRows(invoices, publicKey));
      setLoading(false);
    };

    load().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, [publicKey]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "date") return mul * (a.date - b.date);
      const diff = a.amountPaid - b.amountPaid;
      return mul * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
    });
  }, [rows, sortField, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paged = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalPaid = useMemo(() => rows.reduce((s, r) => s + r.amountPaid, 0n), [rows]);
  const invoiceCount = useMemo(() => new Set(rows.map((r) => r.invoiceId)).size, [rows]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortField]
  );

  const sortLabel = (field: SortField) =>
    sortField === field ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Payment History</h1>
        {!loading && rows.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(sorted)}
            className="min-h-10 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Download CSV
          </button>
        )}
      </div>

      {/* Summary */}
      {!loading && rows.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You have paid{" "}
            <span className="font-semibold text-indigo-400">{formatAmount(totalPaid)} XLM</span>{" "}
            across{" "}
            <span className="font-semibold text-indigo-400">{invoiceCount}</span>{" "}
            {invoiceCount === 1 ? "invoice" : "invoices"}
          </p>
        </div>
      )}

      {/* Table / Card list */}
      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading payments">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPaymentRow key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 text-center">
          <p className="text-gray-500 text-lg">No payments yet</p>
          <Link
            href="/"
            className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Browse Invoices
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-900 text-left">
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className="hover:text-indigo-400 transition-colors focus:outline-none focus-visible:underline"
                    >
                      Date{sortLabel("date")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="hover:text-indigo-400 transition-colors focus:outline-none focus-visible:underline"
                    >
                      Amount Paid{sortLabel("amount")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Tip</th>
                  <th className="px-4 py-3 font-semibold">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr
                    key={`${row.invoiceId}-${i}`}
                    className="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.date * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoice/${row.invoiceId}`}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {row.invoiceTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {formatAmount(row.amountPaid)} XLM
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-gray-500">
                      {row.tipAmount > 0n ? `${formatAmount(row.tipAmount)} XLM` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.txHash ? (
                        <a
                          href={`${STELLAR_EXPERT_BASE}/${row.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {truncateAddress(row.txHash, 6)}
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="sm:hidden flex flex-col gap-3" aria-label="Payment history">
            {paged.map((row, i) => (
              <li
                key={`${row.invoiceId}-${i}`}
                className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link
                    href={`/invoice/${row.invoiceId}`}
                    className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {row.invoiceTitle}
                  </Link>
                  <span className="text-xs text-gray-500">
                    {new Date(row.date * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-mono">{formatAmount(row.amountPaid)} XLM</span>
                </div>
                {row.tipAmount > 0n && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600 dark:text-gray-400">Tip</span>
                    <span className="font-mono">{formatAmount(row.tipAmount)} XLM</span>
                  </div>
                )}
                {row.txHash && (
                  <div className="mt-2">
                    <a
                      href={`${STELLAR_EXPERT_BASE}/${row.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {truncateAddress(row.txHash, 6)} ↗
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Sort controls on mobile */}
          <div className="sm:hidden flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => toggleSort("date")}
              className="min-h-9 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-semibold"
            >
              Sort by Date{sortLabel("date")}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("amount")}
              className="min-h-9 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-semibold"
            >
              Sort by Amount{sortLabel("amount")}
            </button>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm text-gray-500">
                Page {page} of {pageCount} ({sorted.length} payments)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="min-h-10 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  aria-label="Next page"
                  className="min-h-10 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
