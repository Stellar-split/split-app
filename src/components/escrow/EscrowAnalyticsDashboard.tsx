"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@stellar-split/sdk";
import type { EscrowAnalyticsReport, EscrowContract, EscrowStatus } from "@/types/escrow";
import { computeEscrowAnalytics, generateEscrowMarkdownReport } from "@/lib/escrow/analytics";

interface Props {
  escrows: EscrowContract[];
  title?: string;
}

export default function EscrowAnalyticsDashboard({
  escrows,
  title = "Escrow Analytics & Reporting",
}: Props) {
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);

  const report: EscrowAnalyticsReport = useMemo(() => {
    return computeEscrowAnalytics(
      selectedStatus === "ALL"
        ? escrows
        : escrows.filter((e) => e.status === selectedStatus)
    );
  }, [escrows, selectedStatus]);

  const handleCopyReport = () => {
    const md = generateEscrowMarkdownReport(report);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { summary, byStatus, byConditionType, byToken } = report;

  return (
    <div
      data-testid="escrow-analytics-dashboard"
      className="rounded-xl border border-gray-800 bg-gray-900/90 p-6 text-white shadow-xl backdrop-blur-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            {title}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time escrow contracts, condition evaluations, dispute holds, and value metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter escrows by status"
          >
            <option value="ALL">All Statuses ({escrows.length})</option>
            <option value="Created">Created</option>
            <option value="Funded">Funded</option>
            <option value="Evaluating">Evaluating</option>
            <option value="ReadyForRelease">Ready For Release</option>
            <option value="Released">Released</option>
            <option value="Disputed">Disputed</option>
            <option value="Refunded">Refunded</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={handleCopyReport}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {copied ? "Copied Report!" : "Export Report"}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg bg-gray-800/60 p-4 border border-gray-700/50">
          <p className="text-xs font-medium text-gray-400">Total Value Locked (TVL)</p>
          <p className="text-xl font-bold text-blue-400 mt-1 tabular-nums">
            {formatAmount(summary.totalValueLocked)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{summary.activeEscrows} active escrows</p>
        </div>

        <div className="rounded-lg bg-gray-800/60 p-4 border border-gray-700/50">
          <p className="text-xs font-medium text-gray-400">Released Funds</p>
          <p className="text-xl font-bold text-green-400 mt-1 tabular-nums">
            {formatAmount(summary.totalValueReleased)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{summary.releasedEscrows} completed payouts</p>
        </div>

        <div className="rounded-lg bg-gray-800/60 p-4 border border-gray-700/50">
          <p className="text-xs font-medium text-gray-400">Dispute Rate</p>
          <p className="text-xl font-bold text-amber-400 mt-1 tabular-nums">
            {summary.disputeRatePercentage}%
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {summary.disputedEscrows} disputed / {summary.disputeResolutionRatePercentage}% resolved
          </p>
        </div>

        <div className="rounded-lg bg-gray-800/60 p-4 border border-gray-700/50">
          <p className="text-xs font-medium text-gray-400">Total Escrows</p>
          <p className="text-xl font-bold text-purple-400 mt-1 tabular-nums">
            {summary.totalEscrows}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {summary.completedEscrows} finalized ({summary.refundedEscrows} refunded)
          </p>
        </div>
      </div>

      {/* Status Breakdown & Condition Pass Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Status Distribution</h3>
          <div className="space-y-2">
            {(Object.keys(byStatus) as EscrowStatus[]).map((status) => {
              const count = byStatus[status];
              const pct = summary.totalEscrows > 0 ? (count / summary.totalEscrows) * 100 : 0;
              return (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 w-28">{status}</span>
                  <div className="flex-1 mx-3 h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        status === "Released"
                          ? "bg-green-500"
                          : status === "Disputed"
                          ? "bg-amber-500"
                          : status === "Refunded"
                          ? "bg-rose-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-400 font-mono tabular-nums w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Condition Pass Rates */}
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Condition Evaluation Pass Rates</h3>
          <div className="space-y-2.5">
            {Object.entries(byConditionType).map(([type, stat]) => {
              return (
                <div key={type} className="text-xs">
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span>{type}</span>
                    <span className="font-mono text-gray-400">
                      {stat.met}/{stat.total} ({stat.passRatePercentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${stat.passRatePercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Token Distribution */}
      {Object.keys(byToken).length > 0 && (
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">Volume by Token Asset</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(byToken).map(([token, val]) => (
              <div key={token} className="rounded border border-gray-700/40 bg-gray-850 p-2.5">
                <p className="text-xs font-semibold text-gray-200">{token}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Volume: <span className="text-white font-mono">{formatAmount(val.totalVolume)}</span>
                </p>
                <p className="text-xs text-gray-400">
                  TVL: <span className="text-blue-400 font-mono">{formatAmount(val.activeTvl)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
