"use client";

import { formatAmount, truncateAddress, type Payment } from "@stellar-split/sdk";

export type PayerHealth = "healthy" | "concentrated";

export interface PayerHealthRow {
  payer: string;
  total: bigint;
  count: number;
  /** Share of all paid funds, 0-100. */
  share: number;
  health: PayerHealth;
}

/** Share (percent) above which a single payer is flagged as a concentration risk. */
export const CONCENTRATION_THRESHOLD = 50;

/** Aggregates payments per payer wallet, sorted by total paid (descending). */
export function computePayerHealth(payments: Payment[]): PayerHealthRow[] {
  const byPayer = new Map<string, { total: bigint; count: number }>();
  let grand = 0n;
  for (const p of payments) {
    const row = byPayer.get(p.payer) ?? { total: 0n, count: 0 };
    row.total += p.amount;
    row.count += 1;
    byPayer.set(p.payer, row);
    grand += p.amount;
  }
  return Array.from(byPayer, ([payer, { total, count }]) => {
    const share = grand > 0n ? Number((total * 10_000n) / grand) / 100 : 0;
    return {
      payer,
      total,
      count,
      share,
      health: byPayer.size > 1 && share > CONCENTRATION_THRESHOLD ? "concentrated" : "healthy",
    } satisfies PayerHealthRow;
  }).sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
}

export default function PayerWalletHealth({ payments }: { payments: Payment[] }) {
  const rows = computePayerHealth(payments);

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6" aria-labelledby="payer-health-heading">
      <h2 id="payer-health-heading" className="text-lg font-semibold text-white mb-3">
        Payer Wallet Health
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No payer wallets yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="py-2 pr-3 font-medium">Wallet</th>
                <th className="py-2 pr-3 font-medium">Payments</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Share</th>
                <th className="py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {rows.map((r) => (
                <tr key={r.payer} className="border-t border-gray-700">
                  <td className="py-2 pr-3 font-mono" title={r.payer}>
                    {truncateAddress(r.payer)}
                  </td>
                  <td className="py-2 pr-3">{r.count}</td>
                  <td className="py-2 pr-3">{formatAmount(r.total)}</td>
                  <td className="py-2 pr-3">{r.share.toFixed(1)}%</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.health === "healthy" ? "bg-green-900/50 text-green-300" : "bg-yellow-900/50 text-yellow-300"
                      }`}
                    >
                      {r.health === "healthy" ? "Healthy" : "Concentrated"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
