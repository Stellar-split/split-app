"use client";

import { useMemo } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  publicKey?: string | null;
  className?: string;
}

interface Contributor {
  address: string;
  totalPaid: bigint;
  paymentCount: number;
}

export default function InvoiceLeaderboard({ invoice, publicKey, className = "" }: Props) {
  const contributors = useMemo<Contributor[]>(() => {
    if (!invoice.payments || invoice.payments.length === 0) return [];

    const map = new Map<string, { total: bigint; count: number }>();
    for (const p of invoice.payments) {
      const existing = map.get(p.payer) || { total: 0n, count: 0 };
      map.set(p.payer, {
        total: existing.total + p.amount,
        count: existing.count + 1,
      });
    }

    return Array.from(map.entries())
      .map(([address, data]) => ({
        address,
        totalPaid: data.total,
        paymentCount: data.count,
      }))
      .sort((a, b) => (b.totalPaid > a.totalPaid ? 1 : b.totalPaid < a.totalPaid ? -1 : 0));
  }, [invoice.payments]);

  const totalFunded = invoice.funded;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-base" title="1st Place">🥇</span>;
    if (rank === 2) return <span className="text-base" title="2nd Place">🥈</span>;
    if (rank === 3) return <span className="text-base" title="3rd Place">🥉</span>;
    return <span className="text-xs text-gray-500 font-mono">#{rank}</span>;
  };

  return (
    <section
      aria-labelledby="invoice-leaderboard-heading"
      className={`rounded-2xl border border-gray-800 bg-gray-900/60 p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2
            id="invoice-leaderboard-heading"
            className="text-base font-semibold text-white flex items-center gap-2"
          >
            <span>🏆</span> Top Contributors
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Payer leaderboard celebrating top supporters for this invoice
          </p>
        </div>
        <span className="text-xs bg-gray-800 border border-gray-700 text-gray-300 font-medium px-2.5 py-1 rounded-full">
          {contributors.length} Contributor{contributors.length !== 1 ? "s" : ""}
        </span>
      </div>

      {contributors.length === 0 ? (
        <div className="text-center py-6 px-4 bg-gray-800/40 rounded-xl border border-dashed border-gray-700/60">
          <p className="text-sm text-gray-400">No contributions yet.</p>
          <p className="text-xs text-gray-500 mt-1">Be the first to pay and take the #1 spot!</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {contributors.map((c, index) => {
            const rank = index + 1;
            const isUser = Boolean(publicKey && c.address === publicKey);
            const percentage =
              totalFunded > 0n
                ? Math.min(100, Number((c.totalPaid * 10000n) / totalFunded) / 100)
                : 0;

            return (
              <li
                key={c.address}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isUser
                    ? "bg-indigo-950/40 border-indigo-700/60 ring-1 ring-indigo-500/30"
                    : "bg-gray-800/50 border-gray-700/50 hover:bg-gray-800/80"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 text-center shrink-0 flex items-center justify-center">
                    {getRankBadge(rank)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-sm text-gray-200 truncate"
                        title={c.address}
                      >
                        {truncateAddress(c.address)}
                      </span>
                      {isUser && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {c.paymentCount} payment{c.paymentCount !== 1 ? "s" : ""} · {percentage.toFixed(1)}% of funding
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-white">
                    {formatAmount(c.totalPaid)} <span className="text-xs text-gray-400 font-normal">{invoice.token || "USDC"}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
