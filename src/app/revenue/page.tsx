"use client";

import { useEffect, useMemo, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Invoice } from "@stellar-split/sdk";

/** Convert a bigint USDC amount (7 decimals) to a JS number for charting. */
function toUsdc(amount: bigint): number {
  return Number(amount) / 1e7;
}

/** Return "YYYY-MM" for a unix timestamp in seconds. */
function monthKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Return a human-readable month label like "Jan 25". */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/** Last N months as YYYY-MM keys, oldest first. */
function lastNMonths(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const pk = await getFreighterPublicKey().catch(() => null);
        if (!pk) {
          setError("Connect your wallet to view revenue.");
          return;
        }
        setPublicKey(pk);
        const result: Invoice[] = (await (splitClient as any).getInvoicesByRecipient(pk)) ?? [];
        setInvoices(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Total USDC received (Released invoices where this wallet is a recipient)
  const totalReceived = useMemo(() => {
    if (!publicKey) return 0n;
    return invoices
      .filter((inv) => inv.status === "Released")
      .reduce((sum, inv) => {
        const myShare = inv.recipients
          .filter((r) => r.address === publicKey)
          .reduce((s, r) => s + r.amount, 0n);
        return sum + myShare;
      }, 0n);
  }, [invoices, publicKey]);

  // Monthly revenue for last 6 months
  const monthlyData = useMemo(() => {
    const months = lastNMonths(6);
    const byMonth: Record<string, number> = {};
    months.forEach((m) => (byMonth[m] = 0));

    if (publicKey) {
      for (const inv of invoices) {
        if (inv.status !== "Released") continue;
        for (const payment of inv.payments ?? []) {
          const ts = (payment as { timestamp?: number }).timestamp;
          if (!ts) continue;
          const mk = monthKey(ts);
          if (mk in byMonth) {
            // Attribute payment proportionally to this recipient's share
            const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
            const myShare = inv.recipients
              .filter((r) => r.address === publicKey)
              .reduce((s, r) => s + r.amount, 0n);
            const ratio = total > 0n ? Number(myShare) / Number(total) : 0;
            byMonth[mk] += toUsdc(payment.amount) * ratio;
          }
        }
      }
    }

    return months.map((m) => ({
      month: monthLabel(m),
      usdc: Math.round(byMonth[m] * 100) / 100,
    }));
  }, [invoices, publicKey]);

  // 30-day projection from pending invoices
  const projection = useMemo(() => {
    if (!publicKey) return 0n;
    const now = Date.now() / 1000;
    const in30Days = now + 30 * 86400;
    return invoices
      .filter(
        (inv) =>
          inv.status === "Pending" &&
          (inv.deadline === 0 || inv.deadline <= in30Days)
      )
      .reduce((sum, inv) => {
        const myShare = inv.recipients
          .filter((r) => r.address === publicKey)
          .reduce((s, r) => s + r.amount, 0n);
        return sum + myShare;
      }, 0n);
  }, [invoices, publicKey]);

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Revenue</h1>
      <p className="text-gray-400 mb-8">Your USDC earnings as a recipient across all invoices.</p>

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-800 rounded-xl" />
          <div className="h-48 bg-gray-800 rounded-xl" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-400 text-sm">{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 rounded-xl p-5">
              <p className="text-sm text-gray-400 mb-1">Total USDC Received</p>
              <p className="text-3xl font-bold text-indigo-300">
                {formatAmount(totalReceived)} <span className="text-lg font-normal text-gray-400">USDC</span>
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5">
              <p className="text-sm text-gray-400 mb-1">30-Day Projection</p>
              <p className="text-3xl font-bold text-amber-300">
                {formatAmount(projection)} <span className="text-lg font-normal text-gray-400">USDC</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">From pending invoices due within 30 days</p>
            </div>
          </div>

          {/* Monthly bar chart */}
          <section aria-labelledby="chart-heading" className="bg-gray-900 rounded-xl p-5 mb-8">
            <h2 id="chart-heading" className="text-lg font-semibold mb-4">Monthly Revenue (Last 6 Months)</h2>
            <div className="w-full h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} unit=" USDC" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#818cf8" }}
                    formatter={(value: number) => [`${value} USDC`, "Revenue"]}
                  />
                  <Bar dataKey="usdc" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Invoice breakdown table */}
          <section aria-labelledby="breakdown-heading" className="bg-gray-900 rounded-xl p-5">
            <h2 id="breakdown-heading" className="text-lg font-semibold mb-4">Invoice Breakdown</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices found where you are a recipient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-800">
                      <th className="pb-2 pr-4 font-medium">Invoice ID</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Your Share</th>
                      <th className="pb-2 font-medium">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const myShare = publicKey
                        ? inv.recipients
                            .filter((r) => r.address === publicKey)
                            .reduce((s, r) => s + r.amount, 0n)
                        : 0n;
                      const deadlineStr =
                        inv.deadline > 0
                          ? new Date(inv.deadline * 1000).toLocaleDateString()
                          : "—";
                      const statusColor: Record<string, string> = {
                        Pending: "text-yellow-400",
                        Released: "text-green-400",
                        Refunded: "text-gray-400",
                      };
                      return (
                        <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-2 pr-4 font-mono text-indigo-300">
                            <a href={`/invoice/${inv.id}`} className="hover:underline">
                              #{inv.id}
                            </a>
                          </td>
                          <td className={`py-2 pr-4 font-medium ${statusColor[inv.status] ?? "text-gray-300"}`}>
                            {inv.status}
                          </td>
                          <td className="py-2 pr-4">{formatAmount(myShare)} USDC</td>
                          <td className="py-2 text-gray-400">{deadlineStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
