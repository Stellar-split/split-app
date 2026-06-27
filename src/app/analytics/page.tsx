"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import type { Invoice } from "@stellar-split/sdk";

const STROOPS = 10_000_000;

function stroopsToUsdc(n: bigint): number {
  return Number(n) / STROOPS;
}

type InvoiceWithCreatedAt = Invoice & { createdAt?: number };

const DynamicBarChart = dynamic(
  () =>
    import("recharts").then((m) => {
      const C = ({
        data,
        dataKey,
        fill,
      }: {
        data: Record<string, unknown>[];
        dataKey: string;
        fill: string;
      }) => (
        <m.ResponsiveContainer width="100%" height={280}>
          <m.BarChart data={data}>
            <m.CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <m.XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <m.YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <m.Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#f3f4f6" }}
            />
            <m.Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} />
          </m.BarChart>
        </m.ResponsiveContainer>
      );
      return { default: C };
    }),
  { ssr: false }
);

const DynamicLineChart = dynamic(
  () =>
    import("recharts").then((m) => {
      const C = ({
        data,
        dataKey,
        stroke,
      }: {
        data: Record<string, unknown>[];
        dataKey: string;
        stroke: string;
      }) => (
        <m.ResponsiveContainer width="100%" height={280}>
          <m.LineChart data={data}>
            <m.CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <m.XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <m.YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <m.Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#f3f4f6" }}
              formatter={(v: number) => [`${v.toFixed(2)} USDC`, "Cumulative"]}
            />
            <m.Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              dot={false}
              strokeWidth={2}
            />
          </m.LineChart>
        </m.ResponsiveContainer>
      );
      return { default: C };
    }),
  { ssr: false }
);

function StatCard({
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

function monthKey(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function last6MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
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
          const batch = await (splitClient as any).getInvoicesByCreator(publicKey, offset, 100);
          if (!batch?.length) break;
          results.push(...batch);
          offset += 100;
        }
        setInvoices(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch invoices");
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
    const completionRate = total > 0 ? (released.length / total) * 100 : 0;

    const totalRaised = filtered.reduce((s, i) => s + stroopsToUsdc(i.funded), 0);

    const avgFundingTimeDays =
      released.length > 0
        ? released.reduce(
            (s, i) =>
              s + (i.deadline - (i.createdAt ?? i.deadline - 7 * 86400)) / 86400,
            0
          ) / released.length
        : 0;

    const monthKeys = last6MonthKeys();
    const monthMap = new Map(monthKeys.map((k) => [k, 0]));
    filtered.forEach((inv) => {
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      const k = monthKey(ts);
      if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
    });
    const monthlyBar = monthKeys.map((k) => ({
      label: monthLabel(k),
      count: monthMap.get(k) ?? 0,
    }));

    const sortedByTime = [...filtered].sort((a, b) => {
      const ta = a.createdAt ?? a.deadline - 7 * 86400;
      const tb = b.createdAt ?? b.deadline - 7 * 86400;
      return ta - tb;
    });
    let cumulative = 0;
    const cumulativeLine = sortedByTime.map((inv) => {
      cumulative += stroopsToUsdc(inv.funded);
      const ts = inv.createdAt ?? inv.deadline - 7 * 86400;
      return {
        label: new Date(ts * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        cumulative,
      };
    });

    const payerMap = new Map<string, number>();
    filtered.forEach((inv) => {
      inv.payments.forEach((p) => {
        payerMap.set(p.payer, (payerMap.get(p.payer) ?? 0) + stroopsToUsdc(p.amount));
      });
    });
    const topPayers = Array.from(payerMap.entries())
      .map(([address, total]) => ({ address, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      total,
      completionRate,
      totalRaised,
      avgFundingTimeDays,
      monthlyBar,
      cumulativeLine,
      topPayers,
    };
  }, [filtered]);

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
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Invoices" value={stats.total} />
          <StatCard
            label="Total Raised"
            value={`$${stats.totalRaised.toFixed(2)}`}
            sub="USDC"
          />
          <StatCard
            label="Avg Funding Time"
            value={`${stats.avgFundingTimeDays.toFixed(1)}d`}
            sub="released invoices"
          />
          <StatCard
            label="Completion Rate"
            value={`${stats.completionRate.toFixed(1)}%`}
            sub="released / total"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              Invoices per Month (last 6 months)
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicBarChart
                data={stats.monthlyBar}
                dataKey="count"
                fill="#6366f1"
              />
            </Suspense>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
              Cumulative Funds Raised (USDC)
            </h2>
            <Suspense fallback={<ChartFallback />}>
              <DynamicLineChart
                data={stats.cumulativeLine}
                dataKey="cumulative"
                stroke="#10b981"
              />
            </Suspense>
          </div>
        </div>

        {/* Top payers table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Top 5 Payers
          </h2>
          {stats.topPayers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No payment data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4 font-medium w-8">#</th>
                    <th className="pb-2 pr-4 font-medium">Address</th>
                    <th className="pb-2 font-medium text-right">Total Contributed</th>
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
