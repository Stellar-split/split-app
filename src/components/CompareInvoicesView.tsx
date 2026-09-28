"use client";

import { useState } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import Link from "next/link";
import FundingProgress from "./FundingProgress";
import StatusBadge from "./StatusBadge";

interface Props {
  invoiceA: Invoice;
  invoiceB: Invoice;
  onPayA?: () => void;
  onPayB?: () => void;
}

type DiffMode = "all" | "diffs-only";

/** Returns a highlight wrapper class when two values differ */
function diffClass(a: string | number, b: string | number): string {
  return String(a) !== String(b)
    ? "ring-2 ring-yellow-400/60 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-2 py-1"
    : "";
}

/** Formats a bigint delta with +/- sign for the summary bar */
function formatDelta(a: bigint, b: bigint): { label: string; positive: boolean; zero: boolean } {
  const diff = b - a;
  if (diff === 0n) return { label: "Equal", positive: true, zero: true };
  const sign = diff > 0n ? "+" : "-";
  return {
    label: `${sign}${formatAmount(diff < 0n ? -diff : diff)} USDC`,
    positive: diff > 0n,
    zero: false,
  };
}

/**
 * CompareInvoicesView — enhanced side-by-side comparison of two invoices.
 *
 * Features:
 * - Yellow ring highlight on fields that differ
 * - Diff-only view toggle to show only differing rows
 * - Summary delta bar showing key metrics at a glance
 * - Progress bars side-by-side
 * - Recipient count comparison
 * - Payment count comparison
 */
export default function CompareInvoicesView({ invoiceA, invoiceB, onPayA, onPayB }: Props) {
  const [diffMode, setDiffMode] = useState<DiffMode>("all");
  const [activeSection, setActiveSection] = useState<"overview" | "details">("overview");

  const totalA = invoiceA.recipients.reduce((s, r) => s + r.amount, 0n);
  const totalB = invoiceB.recipients.reduce((s, r) => s + r.amount, 0n);

  const deadlineA = new Date(invoiceA.deadline * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const deadlineB = new Date(invoiceB.deadline * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const progressA = totalA > 0n ? Math.round((Number(invoiceA.funded) / Number(totalA)) * 100) : 0;
  const progressB = totalB > 0n ? Math.round((Number(invoiceB.funded) / Number(totalB)) * 100) : 0;

  const paymentCountA = invoiceA.payments?.length ?? 0;
  const paymentCountB = invoiceB.payments?.length ?? 0;

  const tokenA = invoiceA.token ?? "USDC";
  const tokenB = invoiceB.token ?? "USDC";

  // All comparison rows
  const rows: {
    label: string;
    valA: React.ReactNode;
    valB: React.ReactNode;
    rawA: string | number;
    rawB: string | number;
  }[] = [
    {
      label: "Status",
      rawA: String(invoiceA.status),
      rawB: String(invoiceB.status),
      valA: <StatusBadge status={invoiceA.status as any} size="sm" />,
      valB: <StatusBadge status={invoiceB.status as any} size="sm" />,
    },
    {
      label: "Total Amount",
      rawA: formatAmount(totalA),
      rawB: formatAmount(totalB),
      valA: <span className="font-semibold text-gray-900 dark:text-white">{formatAmount(totalA)} {tokenA}</span>,
      valB: <span className="font-semibold text-gray-900 dark:text-white">{formatAmount(totalB)} {tokenB}</span>,
    },
    {
      label: "Funded",
      rawA: formatAmount(invoiceA.funded),
      rawB: formatAmount(invoiceB.funded),
      valA: <span>{formatAmount(invoiceA.funded)} / {formatAmount(totalA)} {tokenA}</span>,
      valB: <span>{formatAmount(invoiceB.funded)} / {formatAmount(totalB)} {tokenB}</span>,
    },
    {
      label: "Progress",
      rawA: progressA,
      rawB: progressB,
      valA: (
        <div className="w-full">
          <FundingProgress funded={invoiceA.funded} total={totalA} token={tokenA} />
          <span className="text-xs text-gray-500 mt-1 block">{progressA}%</span>
        </div>
      ),
      valB: (
        <div className="w-full">
          <FundingProgress funded={invoiceB.funded} total={totalB} token={tokenB} />
          <span className="text-xs text-gray-500 mt-1 block">{progressB}%</span>
        </div>
      ),
    },
    {
      label: "Deadline",
      rawA: deadlineA,
      rawB: deadlineB,
      valA: <span>{deadlineA}</span>,
      valB: <span>{deadlineB}</span>,
    },
    {
      label: "Recipients",
      rawA: invoiceA.recipients.map((r) => r.address).join(","),
      rawB: invoiceB.recipients.map((r) => r.address).join(","),
      valA: (
        <div className="flex flex-wrap gap-1">
          {invoiceA.recipients.map((r, i) => (
            <span key={i} className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
              {truncateAddress(r.address)}
            </span>
          ))}
          <span className="text-xs text-gray-500">({invoiceA.recipients.length})</span>
        </div>
      ),
      valB: (
        <div className="flex flex-wrap gap-1">
          {invoiceB.recipients.map((r, i) => (
            <span key={i} className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
              {truncateAddress(r.address)}
            </span>
          ))}
          <span className="text-xs text-gray-500">({invoiceB.recipients.length})</span>
        </div>
      ),
    },
    {
      label: "Payments",
      rawA: paymentCountA,
      rawB: paymentCountB,
      valA: <span>{paymentCountA}</span>,
      valB: <span>{paymentCountB}</span>,
    },
    {
      label: "Token",
      rawA: tokenA,
      rawB: tokenB,
      valA: <span className="font-mono">{tokenA}</span>,
      valB: <span className="font-mono">{tokenB}</span>,
    },
  ];

  const visibleRows =
    diffMode === "diffs-only"
      ? rows.filter((r) => String(r.rawA) !== String(r.rawB))
      : rows;

  const diffCount = rows.filter((r) => String(r.rawA) !== String(r.rawB)).length;

  // Delta summary values
  const totalDelta = formatDelta(totalA, totalB);
  const fundedDelta = formatDelta(invoiceA.funded, invoiceB.funded);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6 inline-block"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Compare Invoices
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Invoice <span className="font-mono text-indigo-500">#{invoiceA.id}</span> vs Invoice{" "}
          <span className="font-mono text-indigo-500">#{invoiceB.id}</span>
        </p>
      </div>

      {/* Delta Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Differences</p>
          <p className={`text-xl font-bold ${diffCount > 0 ? "text-yellow-500" : "text-emerald-500"}`}>
            {diffCount}
          </p>
          <p className="text-xs text-gray-400">field{diffCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Amount Δ (B vs A)</p>
          <p className={`text-sm font-bold ${totalDelta.zero ? "text-gray-400" : totalDelta.positive ? "text-emerald-500" : "text-red-400"}`}>
            {totalDelta.label}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Funded Δ (B vs A)</p>
          <p className={`text-sm font-bold ${fundedDelta.zero ? "text-gray-400" : fundedDelta.positive ? "text-emerald-500" : "text-red-400"}`}>
            {fundedDelta.label}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Progress Δ</p>
          <p className={`text-sm font-bold ${progressA === progressB ? "text-gray-400" : progressB > progressA ? "text-emerald-500" : "text-red-400"}`}>
            {progressA === progressB
              ? "Equal"
              : `${progressB > progressA ? "+" : ""}${progressB - progressA}%`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block w-3 h-3 rounded ring-2 ring-yellow-400/60 bg-yellow-50 dark:bg-yellow-900/20" />
          Highlighted rows differ
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiffMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              diffMode === "all"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
            aria-pressed={diffMode === "all"}
          >
            All fields
          </button>
          <button
            onClick={() => setDiffMode("diffs-only")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              diffMode === "diffs-only"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
            aria-pressed={diffMode === "diffs-only"}
          >
            Diffs only ({diffCount})
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      {visibleRows.length === 0 ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center">
          <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
            ✓ No differences found — these invoices are identical in all compared fields.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Field
            </div>
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-l border-gray-200 dark:border-gray-700">
              Invoice A <span className="font-mono text-indigo-500 normal-case">#{invoiceA.id}</span>
            </div>
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-l border-gray-200 dark:border-gray-700">
              Invoice B <span className="font-mono text-indigo-500 normal-case">#{invoiceB.id}</span>
            </div>
          </div>

          {/* Rows */}
          {visibleRows.map((row, idx) => {
            const differs = String(row.rawA) !== String(row.rawB);
            const rowBg = idx % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/20";
            return (
              <div
                key={row.label}
                className={`grid grid-cols-3 gap-0 border-b border-gray-100 dark:border-gray-800 last:border-0 ${rowBg}`}
                role="row"
              >
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 self-start pt-3.5">
                  {row.label}
                </div>
                <div className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-200 border-l border-gray-100 dark:border-gray-800 ${differs ? diffClass(row.rawA, row.rawB) : ""}`}>
                  {row.valA}
                </div>
                <div className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-200 border-l border-gray-100 dark:border-gray-800 ${differs ? diffClass(row.rawA, row.rawB) : ""}`}>
                  {row.valB}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <button
          onClick={onPayA}
          className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          aria-label={`Pay Invoice ${invoiceA.id}`}
        >
          Pay Invoice A <span className="font-mono opacity-75">#{invoiceA.id}</span>
        </button>
        <button
          onClick={onPayB}
          className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          aria-label={`Pay Invoice ${invoiceB.id}`}
        >
          Pay Invoice B <span className="font-mono opacity-75">#{invoiceB.id}</span>
        </button>
      </div>
    </div>
  );
}
