"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

type LeaderboardRow = {
  address: string;
  totalPaid: bigint;
  invoiceCount: number;
};

export default function LeaderboardPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

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
        for (let id = 1; id <= 100; id++) {
          try {
            const inv = await splitClient.getInvoice(String(id));
            invoiceList.push(inv);
          } catch {
            // Once invoices stop existing, further calls likely fail as well.
            break;
          }
        }

        const totals = new Map<
          string,
          { totalPaid: bigint; invoiceIds: Set<string> }
        >();

        for (const inv of invoiceList) {
          for (const payment of inv.payments) {
            const address = payment.payer;
            if (!address) continue;

            const entry = totals.get(address);
            if (!entry) {
              totals.set(address, {
                totalPaid: payment.amount,
                invoiceIds: new Set([inv.id]),
              });
            } else {
              entry.totalPaid += payment.amount;
              entry.invoiceIds.add(inv.id);
            }
          }
        }

        const nextRows: LeaderboardRow[] = Array.from(totals.entries())
          .map(([address, v]) => ({
            address,
            totalPaid: v.totalPaid,
            invoiceCount: v.invoiceIds.size,
          }))
          .sort((a, b) =>
            b.totalPaid > a.totalPaid ? 1 : b.totalPaid < a.totalPaid ? -1 : 0,
          )
          .slice(0, 20);

        if (!cancelled) setRows(nextRows);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const walletRank = useMemo(() => {
    if (!publicKey) return null;
    const idx = rows.findIndex((r) => r.address === publicKey);
    return idx >= 0 ? idx + 1 : null;
  }, [publicKey, rows]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <div className="text-sm text-gray-400">
          Top USDC contributors across the latest invoices (1–100)
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-950/40 border border-red-900 text-red-300 rounded-xl px-4 py-3 mb-6"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="h-6 bg-gray-800 rounded mb-3" aria-hidden="true" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-8 h-5 bg-gray-800 rounded" aria-hidden="true" />
              <div
                className="flex-1 h-5 bg-gray-800 rounded"
                aria-hidden="true"
              />
              <div
                className="w-28 h-5 bg-gray-800 rounded"
                aria-hidden="true"
              />
              <div
                className="w-24 h-5 bg-gray-800 rounded"
                aria-hidden="true"
              />
            </div>
          ))}
          <div className="h-3 bg-gray-800 rounded" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-gray-400">No payments found in invoices.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[520px] bg-gray-900 rounded-xl border border-gray-800">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-gray-500 border-b border-gray-800">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5">Address</div>
              <div className="col-span-3">Total USDC</div>
              <div className="col-span-3">Invoices</div>
            </div>

            <ul>
              {rows.map((r, idx) => {
                const rank = idx + 1;
                const isWallet = publicKey && r.address === publicKey;

                return (
                  <li
                    key={r.address}
                    className={
                      isWallet
                        ? "grid grid-cols-12 gap-2 px-4 py-4 items-center bg-indigo-600/15 border-b border-indigo-400/20"
                        : "grid grid-cols-12 gap-2 px-4 py-4 items-center border-b border-gray-800 hover:bg-gray-800/50"
                    }
                    aria-current={isWallet ? "page" : undefined}
                  >
                    <div className="col-span-1 font-semibold text-gray-200">
                      {rank}
                    </div>
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-gray-300 truncate"
                        title={r.address}
                      >
                        {truncateAddress(r.address)}
                      </span>
                      {isWallet && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-semibold">
                          You
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 font-semibold text-indigo-200">
                      {formatAmount(r.totalPaid)}
                    </div>
                    <div className="col-span-3 text-gray-300">
                      {r.invoiceCount}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {walletRank && (
        <p className="mt-4 text-sm text-gray-400" role="status">
          Your wallet is ranked #{walletRank}.
          {!loading && !rows.some((r) => r.address === publicKey) && (
            <span className="text-gray-500"> (not in top 20)</span>
          )}
        </p>
      )}

      <div className="mt-8 text-sm text-gray-500">
        <Link
          href="/dashboard"
          className="text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
