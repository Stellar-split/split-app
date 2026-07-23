"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { generateCsv, type CsvRow } from "@/lib/csvExport";
import type { Invoice } from "@stellar-split/sdk";

const STROOPS = 10_000_000;

function stroopsToUsdc(n: bigint): number {
  return Number(n) / STROOPS;
}

type InvoiceWithCreatedAt = Invoice & { createdAt?: number };

const DynamicWeeklyRaisedChart = dynamic(
  () => import("@/components/analytics/WeeklyRaisedChart"),
  { ssr: false }
);

const DynamicStatusPieChart = dynamic(
  () => import("@/components/analytics/StatusPieChart"),
  { ssr: false }
);

const DynamicUniquePayersChart = dynamic(
  () => import("@/components/analytics/UniquePayersChart"),
  { ssr: false }
);

const DynamicFundingTimeHistogram = dynamic(
  () => import("@/components/analytics/FundingTimeHistogram"),
  { ssr: false }
);

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function weekKey(ts: number): string {
  const d = new Date(ts * 1000);
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
  const parts = key.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function last12WeekKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    keys.push(
      `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
    );
  }
  return keys;
}

function computeHistogramBins(
  values: number[],
  binCount = 8
): { label: string; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: `${min.toFixed(0)}h`, count: values.length }];
  }
  const range = max - min;
  const binWidth = range / binCount;
  const bins: { label: string; count: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const lo = min + i * binWidth;
    const hi = min + (i + 1) * binWidth;
    const count = values.filter((v) => (i === binCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi)).length;
    bins.push({ label: `${lo.toFixed(1)}-${hi.toFixed(1)}h`, count });
  }
  return bins;
}

const ChartFallback = () => (
  <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
    Loading chart…
  </div>
);

export default function AnalyticsPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithCreatedAt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view analytics."));
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const results: InvoiceWithCreatedAt[] = [];
        let offset = 0;
        while (true) {
          const batch = await (splitClient as any).getInvoicesByCreator(
            publicKey,
            offset,
            100
          );
          if (!batch?.length) break;
          results.push(...batch);
          offset += 100;
        }
        setInvoices(results);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch invoices"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [publicKey]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      const d = new Date(ts * 1000);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [invoices, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const released = filtered.filter((i) => i.status === "Released");
    const refunded = filtered.filter((i) => i.status === "Refunded");
    const pending = filtered.filter((i) => i.status === "Pending");

    const totalRaised = filtered.reduce(
      (s, i) => s + stroopsToUsdc(i.funded),
      0
    );
    const totalReleased = released.reduce(
      (s, i) => s + stroopsToUsdc(i.funded),
      0
    );
    const successRate = total > 0 ? (released.length / total) * 100 : 0;

    const fundingTimesHours: number[] = [];
    released.forEach((inv) => {
      const created = inv.createdAt ?? inv.deadline - 7 * 86400;
      const hours = (inv.deadline - created) / 3600;
      fundingTimesHours.push(hours);
    });
    const avgFundingTimeHours =
      fundingTimesHours.length > 0
        ? fundingTimesHours.reduce((a, b) => a + b, 0) /
          fundingTimesHours.length
        : 0;

    const weekKeys = last12WeekKeys();
    const weekMap = new Map(weekKeys.map((k) => [k, 0]));
    filtered.forEach((inv) => {
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      const k = weekKey(ts);
      if (weekMap.has(k)) {
        weekMap.set(k, (weekMap.get(k) ?? 0) + stroopsToUsdc(inv.funded));
      }
    });
    const weeklyRaised = weekKeys.map((k) => ({
      label: weekLabel(k),
      amount: parseFloat((weekMap.get(k) ?? 0).toFixed(2)),
    }));

    const statusData = [
      { name: "Released", value: released.length },
      { name: "Refunded", value: refunded.length },
      { name: "Active", value: pending.length },
      {
        name: "Expired",
        value: filtered.filter(
          (i) => i.status === "Pending" && i.deadline < Date.now() / 1000
        ).length,
      },
    ].filter((d) => d.value > 0);

    const payerTimeline = new Map<string, Set<string>>();
    const sortedInvoices = [...filtered].sort((a, b) => {
      const ta = a.createdAt ?? a.deadline - 7 * 86400;
      const tb = b.createdAt ?? b.deadline - 7 * 86400;
      return ta - tb;
    });
    const uniquePayersOverTime: { label: string; count: number }[] = [];
    let cumulativePayers = new Set<string>();
    sortedInvoices.forEach((inv) => {
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      const dateStr = new Date(ts * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      inv.payments.forEach((p) => {
        cumulativePayers.add(p.payer);
      });
      payerTimeline.set(dateStr, new Set(cumulativePayers));
    });
    const seenDates = new Set<string>();
    sortedInvoices.forEach((inv) => {
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      const dateStr = new Date(ts * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        uniquePayersOverTime.push({
          label: dateStr,
          count: payerTimeline.get(dateStr)?.size ?? 0,
        });
      }
    });

    const histogramBins = computeHistogramBins(fundingTimesHours);

    const payerMap = new Map<string, number>();
    filtered.forEach((inv) => {
      inv.payments.forEach((p) => {
        payerMap.set(
          p.payer,
          (payerMap.get(p.payer) ?? 0) + stroopsToUsdc(p.amount)
        );
      });
    });
    const topPayers = Array.from(payerMap.entries())
      .map(([address, total]) => ({ address, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      total,
      totalRaised,
      totalReleased,
      successRate,
      avgFundingTimeHours,
      weeklyRaised,
      statusData,
      uniquePayersOverTime,
      histogramBins,
      topPayers,
    };
  }, [filtered]);

  const csvRows = useMemo<CsvRow[]>(() => {
    return filtered.map((inv) => ({
      id: inv.id,
      status: inv.status,
      creator: inv.creator,
      funded_usdc: stroopsToUsdc(inv.funded).toFixed(2),
      deadline: new Date(inv.deadline * 1000).toISOString(),
      recipients: inv.recipients.length,
      payments: inv.payments.length,
      unique_payers: new Set(inv.payments.map((p) => p.payer)).size,
    }));
  }, [filtered]);

  function handleExportCsv() {
    generateCsv(csvRows, "stellar-split-analytics");
  }

  if (!publicKey && !loading && !error) {
    return (
      <main className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-400">
            Please connect your wallet to view analytics.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-400">Loading analytics…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">Analytics</h1>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-gray-400">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label className="text-gray-400">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="ml-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total Raised"
            value={`$${stats.totalRaised.toFixed(2)}`}
            sub="USDC"
          />
          <KpiCard
            label="Total Released"
            value={`$${stats.totalReleased.toFixed(2)}`}
            sub="USDC"
          />
          <KpiCard
            label="Success Rate"
            value={`${stats.successRate.toFixed(1)}%`}
            sub={`${stats.total} invoices`}
          />
          <KpiCard
            label="Avg Funding Time"
            value={`${stats.avgFundingTimeHours.toFixed(1)}h`}
            sub="released invoices"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              USDC Raised per Week (last 12 weeks)
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicWeeklyRaisedChart data={stats.weeklyRaised} />
            </Suspense>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              Invoice Status Breakdown
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicStatusPieChart data={stats.statusData} />
            </Suspense>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              Unique Payers Over Time
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicUniquePayersChart data={stats.uniquePayersOverTime} />
            </Suspense>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              Funding Time Distribution (hours)
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicFundingTimeHistogram data={stats.histogramBins} />
            </Suspense>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Top Invoices by Volume
          </h2>
          {stats.topPayers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No payment data yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4 font-medium w-8">#</th>
                    <th className="pb-2 pr-4 font-medium">Address</th>
                    <th className="pb-2 font-medium text-right">
                      Total Contributed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPayers.map((p, i) => (
                    <tr
                      key={p.address}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-gray-500">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-mono text-gray-300 truncate max-w-[160px] sm:max-w-xs">
                        {p.address}
                      </td>
                      <td className="py-2.5 text-right text-indigo-300 font-medium">
                        {p.total.toFixed(2)} USDC
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Link
          href="/dashboard"
          className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
