"use client";

import { useMemo, useState } from "react";
import {
  computeMetrics,
  collaborationStats,
  buildTrends,
  exportMetricsCsv,
  exportStatsCsv,
  type PartnershipInvoice,
} from "@/lib/creatorPartnershipDashboard";

interface CreatorPartnershipDashboardProps {
  invoices: PartnershipInvoice[];
  /** Reference "now" for deterministic metrics/trends (epoch ms). */
  now?: number;
}

/**
 * Dashboard summarizing a creator's partnerships: headline metrics,
 * per-partner collaboration stats, period-over-period trends, and CSV export.
 */
export default function CreatorPartnershipDashboard({
  invoices,
  now,
}: CreatorPartnershipDashboardProps) {
  const [exported, setExported] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeMetrics(invoices, now),
    [invoices, now]
  );
  const stats = useMemo(() => collaborationStats(invoices), [invoices]);
  const trends = useMemo(
    () => buildTrends(invoices, undefined, undefined, now),
    [invoices, now]
  );

  const handleExport = (kind: "metrics" | "stats") => {
    const csv =
      kind === "metrics" ? exportMetricsCsv(metrics) : exportStatsCsv(stats);
    if (typeof window !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partnerships-${kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExported(kind);
  };

  return (
    <section data-testid="creator-partnership-dashboard">
      <h2 className="text-lg font-semibold mb-3">Partnerships</h2>

      <ul className="grid grid-cols-2 gap-3 mb-6" aria-label="Partnership metrics">
        <li data-testid="metric-total-partnerships">
          <span className="block text-xs text-gray-400">Partnerships</span>
          <span className="text-xl font-bold">{metrics.totalPartnerships}</span>
        </li>
        <li data-testid="metric-active-partnerships">
          <span className="block text-xs text-gray-400">Active</span>
          <span className="text-xl font-bold">{metrics.activePartnerships}</span>
        </li>
        <li data-testid="metric-total-invoices">
          <span className="block text-xs text-gray-400">Invoices</span>
          <span className="text-xl font-bold">{metrics.totalInvoices}</span>
        </li>
        <li data-testid="metric-total-volume">
          <span className="block text-xs text-gray-400">Volume</span>
          <span className="text-xl font-bold">{metrics.totalVolume}</span>
        </li>
      </ul>

      <h3 className="text-md font-semibold mb-2">Collaboration stats</h3>
      {stats.length === 0 ? (
        <p className="text-sm text-gray-400">No collaborations yet.</p>
      ) : (
        <table className="w-full text-sm mb-6" aria-label="Collaboration stats">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="py-1">Partner</th>
              <th className="py-1">Collaborations</th>
              <th className="py-1">Volume</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.partnerAddress} data-testid="partner-row">
                <td className="py-1 font-mono text-xs">{s.partnerAddress}</td>
                <td className="py-1">{s.collaborations}</td>
                <td className="py-1">{s.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="text-md font-semibold mb-2">Trends</h3>
      <ul className="flex items-end gap-2 h-24 mb-6" aria-label="Partnership trends">
        {trends.map((t) => {
          const max = Math.max(1, ...trends.map((p) => p.volume));
          const height = Math.round((t.volume / max) * 100);
          return (
            <li
              key={t.periodStart}
              data-testid="trend-point"
              data-volume={t.volume}
              data-partnerships={t.partnerships}
              className="flex-1 flex flex-col items-center justify-end"
            >
              <div
                className="w-full bg-indigo-600 rounded-t"
                style={{ height: `${height}%` }}
                aria-label={`Volume ${t.volume}`}
              />
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleExport("metrics")}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm"
        >
          Export metrics CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport("stats")}
          className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-sm"
        >
          Export stats CSV
        </button>
      </div>
      {exported && (
        <p className="text-xs text-gray-400 mt-2" role="status">
          Exported {exported} CSV
        </p>
      )}
    </section>
  );
}