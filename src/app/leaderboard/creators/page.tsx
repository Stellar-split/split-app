"use client";

import { useEffect, useMemo, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

type CreatorStats = {
  address: string;
  totalUSDC: bigint;
  invoiceCount: number;
  completedCount: number;
};

export default function CreatorLeaderboardPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<(CreatorStats & { rank: number; completionRate: number })[]>([]);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setPublicKey(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const invoiceList: Invoice[] = [];
        for (let id = 1; id <= 200; id++) {
          try {
            const inv = await splitClient.getInvoice(String(id));
            invoiceList.push(inv);
          } catch {
            break;
          }
        }

        const creatorMap = new Map<
          string,
          { totalUSDC: bigint; invoiceIds: Set<string>; completedCount: number }
        >();

        invoiceList.forEach((inv) => {
          const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
          const existing = creatorMap.get(inv.creator) ?? {
            totalUSDC: 0n,
            invoiceIds: new Set(),
            completedCount: 0,
          };

          existing.totalUSDC += total;
          existing.invoiceIds.add(inv.id);
          if (inv.status === "Released") {
            existing.completedCount += 1;
          }

          creatorMap.set(inv.creator, existing);
        });

        const stats: (CreatorStats & { rank: number; completionRate: number })[] = Array.from(
          creatorMap.entries()
        )
          .map(([address, data]) => ({
            address,
            totalUSDC: data.totalUSDC,
            invoiceCount: data.invoiceIds.size,
            completedCount: data.completedCount,
            rank: 0,
            completionRate: data.invoiceIds.size > 0 ? (data.completedCount / data.invoiceIds.size) * 100 : 0,
          }))
          .sort((a, b) => {
            if (b.totalUSDC !== a.totalUSDC) return Number(b.totalUSDC - a.totalUSDC);
            return b.invoiceCount - a.invoiceCount;
          })
          .slice(0, 20)
          .map((stat, i) => ({ ...stat, rank: i + 1 }));

        if (!cancelled) {
          setRows(stats);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const userRank = useMemo(() => {
    if (!publicKey) return null;
    return rows.find((r) => r.address === publicKey);
  }, [rows, publicKey]);

  if (error) {
    return (
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <h1 className="text-3xl font-bold mb-4">Creator Leaderboard</h1>
        <p className="text-red-400" role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-2">Creator Leaderboard</h1>
      <p className="text-gray-400 mb-8">Top 20 creators by total USDC invoiced</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Rank</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Creator</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-300">Total USDC</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-300">Invoices</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-300">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.address}
                  className={`border-b border-gray-800 hover:bg-gray-900/50 transition-colors ${
                    userRank?.address === row.address ? "bg-indigo-900/20" : ""
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-indigo-400">#{row.rank}</td>
                  <td className="py-3 px-4 font-mono text-gray-300 min-w-0">
                    <span className="sm:hidden">{truncateAddress(row.address)}</span>
                    <span className="hidden sm:inline truncate">{row.address}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-300 font-semibold">
                    {formatAmount(row.totalUSDC)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{row.invoiceCount}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{row.completionRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {userRank && (
        <div className="mt-8 p-4 bg-indigo-900/20 border border-indigo-700 rounded-lg">
          <p className="text-sm text-gray-300">
            Your rank: <span className="font-semibold text-indigo-300">#{userRank.rank}</span> with{" "}
            <span className="font-semibold text-indigo-300">{formatAmount(userRank.totalUSDC)} USDC</span> invoiced
          </p>
        </div>
      )}
    </main>
  );
}
