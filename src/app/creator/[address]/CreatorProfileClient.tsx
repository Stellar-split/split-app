/* eslint-disable */
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import StatusBadge from "@/components/StatusBadge";
import FundingProgress from "@/components/FundingProgress";
import CreatorBadges, { type CreatorStats } from "@/components/CreatorBadges";
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
  uniquePayers?: number;
  streakWeeks?: number;
}

const PAGE_SIZE = 5;

type StatusFilterKey = "All" | InvoiceStatus;

/** Thin bar chart rendered purely in CSS for status distribution */
function StatusDistributionChart({ invoices }: { invoices: PublicInvoice[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      map[inv.status] = (map[inv.status] ?? 0) + 1;
    }
    return map;
  }, [invoices]);

  const total = invoices.length;
  if (total === 0) return null;

  const statusColors: Record<string, string> = {
    Released: "bg-emerald-500",
    Pending: "bg-indigo-500",
    Cancelled: "bg-red-500",
    Disputed: "bg-amber-500",
    Expired: "bg-gray-500",
  };

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {entries.map(([status, count]) => {
        const pct = Math.round((count / total) * 100);
        const color = statusColors[status] ?? "bg-gray-600";
        return (
          <div key={status} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-20 shrink-0">{status}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-700`}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${status}: ${pct}%`}
              />
            </div>
            <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** Reputation score gauge */
function ReputationGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDasharray = 2 * Math.PI * 36; // circumference for r=36
  const strokeDashoffset = strokeDasharray * (1 - clampedScore / 100);

  const color =
    clampedScore >= 80
      ? "#10b981"
      : clampedScore >= 50
      ? "#6366f1"
      : "#f59e0b";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 80 80" aria-hidden="true">
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text
          x="40"
          y="44"
          textAnchor="middle"
          className="text-white"
          style={{ fontSize: 18, fontWeight: 700, fill: color }}
        >
          {clampedScore}
        </text>
      </svg>
      <span className="text-xs text-gray-400">/ 100</span>
    </div>
  );
}

export default function CreatorProfileClient({
  address,
  totalInvoices,
  totalVolume,
  completionRate,
  reputationScore = 50,
  invoices,
  uniquePayers = 0,
  streakWeeks = 0,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"invoices" | "stats">("invoices");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("All");

  const badgeStats: CreatorStats = {
    totalInvoices,
    releasedInvoices: Math.round((completionRate / 100) * totalInvoices),
    totalVolumeUsdc: parseFloat(totalVolume.replace(/,/g, "")) || 0,
    completionRate,
    reputationScore,
    uniquePayers,
    streakWeeks,
  };

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

  // Derived statistics
  const stats = useMemo(() => {
    const released = invoices.filter((i) => i.status === "Released");
    const pending = invoices.filter((i) => i.status === "Pending");
    const cancelled = invoices.filter((i) => i.status === "Cancelled");
    const avgFundingPct =
      invoices.length === 0
        ? 0
        : invoices.reduce((sum, inv) => {
            const pct =
              inv.total > 0n
                ? Number((inv.funded * 100n) / inv.total)
                : 0;
            return sum + pct;
          }, 0) / invoices.length;

    const activeInvoices = pending.filter((i) => i.deadline > now);
    const overdueInvoices = pending.filter((i) => i.deadline <= now);

    return {
      released: released.length,
      pending: pending.length,
      cancelled: cancelled.length,
      active: activeInvoices.length,
      overdue: overdueInvoices.length,
      avgFundingPct: Math.round(avgFundingPct),
    };
  }, [invoices, now]);

  const getReputationTier = (score: number) => {
    if (score >= 80)
      return {
        label: "Verified & Highly Trusted",
        color:
          "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
      };
    if (score >= 50)
      return {
        label: "Established Creator",
        color: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
      };
    return {
      label: "Emerging Creator",
      color: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    };
  };

  const tier = getReputationTier(reputationScore);

  // Filtered & paginated invoice list
  const filteredInvoices = useMemo(
    () =>
      statusFilter === "All"
        ? invoices
        : invoices.filter((i) => i.status === statusFilter),
    [invoices, statusFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvoices.length / PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedInvoices = filteredInvoices.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const statusOptions: StatusFilterKey[] = [
    "All",
    "Pending",
    "Released",
    "Cancelled",
    "Disputed",
    "Expired",
  ];

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
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${tier.color}`}
            >
              {tier.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">Public Creator Profile</p>
        </div>
        <button
          onClick={handleShare}
          className="shrink-0 min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
          aria-label="Share creator profile"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Top KPI Stats */}
      <section aria-labelledby="creator-stats-heading" className="mb-6">
        <h2 id="creator-stats-heading" className="sr-only">
          Creator stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-indigo-400 truncate">
              {reputationScore}
              <span className="text-sm font-normal text-gray-500">/100</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Reputation Score</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">
              {totalInvoices}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total Invoices</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">
              {totalVolume} USDC
            </p>
            <p className="text-xs text-gray-400 mt-1">Total Raised</p>
          </div>
          <div className="bg-gray-900 rounded-xl px-4 py-4 text-center border border-gray-800">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">
              {completionRate}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Completion Rate</p>
          </div>
        </div>
      </section>

      {/* Paginated Invoice list */}
      <section aria-labelledby="creator-invoices-heading">        <div className="flex items-center justify-between mb-3">
          <h2 id="creator-invoices-heading" className="text-lg font-semibold text-white">
            Public Invoices ({invoices.length})
          </h2>
          {invoices.length > 0 && (
            <span className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>

      {/* Portfolio Stats Tab */}
      {activeTab === "stats" && (
        <section
          aria-label="Portfolio statistics"
          className="space-y-6"
        >
          {/* Reputation Gauge + Breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              Reputation Score
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ReputationGauge score={reputationScore} />
              <div className="flex-1 space-y-2 w-full">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Tier</span>
                  <span className={tier.color.split(" ")[0]}>{tier.label}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Completion Rate</span>
                  <span className="text-white">{completionRate}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Released Invoices</span>
                  <span className="text-emerald-400">{stats.released}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Avg Funding %</span>
                  <span className="text-white">{stats.avgFundingPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Status Distribution */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              Invoice Status Distribution
            </h3>
            {invoices.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No invoice data yet.
              </p>
            ) : (
              <StatusDistributionChart invoices={invoices} />
            )}
          </div>

          {/* Activity Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">
              Activity Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Active Now", value: stats.active, color: "text-indigo-400" },
                { label: "Overdue", value: stats.overdue, color: "text-red-400" },
                { label: "Released", value: stats.released, color: "text-emerald-400" },
                { label: "Pending", value: stats.pending, color: "text-yellow-400" },
                { label: "Cancelled", value: stats.cancelled, color: "text-gray-400" },
                {
                  label: "Avg Funding",
                  value: `${stats.avgFundingPct}%`,
                  color: "text-white",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-gray-800 rounded-lg px-3 py-3 text-center"
                >
                  <p className={`text-lg font-bold ${item.color}`}>
                    {item.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <section aria-labelledby="creator-invoices-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2
              id="creator-invoices-heading"
              className="text-lg font-semibold text-white"
            >
              Public Invoices ({filteredInvoices.length}
              {statusFilter !== "All" ? ` · ${statusFilter}` : ""})
            </h2>
          </div>

          {/* Status filter chips */}
          <div
            className="flex flex-wrap gap-1.5 mb-4"
            role="group"
            aria-label="Filter by status"
          >
            {statusOptions.map((s) => {
              const count =
                s === "All"
                  ? invoices.length
                  : invoices.filter((i) => i.status === s).length;
              if (s !== "All" && count === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                  aria-pressed={statusFilter === s}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Badges & Achievements */}
      <section aria-labelledby="badges-section" className="mt-8">
        <CreatorBadges stats={badgeStats} />
      </section>
    </>
  );
}
