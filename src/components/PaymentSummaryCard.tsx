"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import { splitClient } from "@/lib/stellar";
import { useInterval } from "@/hooks/useInterval";
import { PaymentAggregator } from "@/lib/PaymentAggregator";
import type { TopPayer } from "@/lib/PaymentAggregator";
import { SkeletonProgress } from "@/components/Skeleton";

const POLL_MS = 10_000;
const RANK_BADGES = ["🥇", "🥈", "🥉"];

function relativeTime(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface AggState {
  total: bigint;
  funded: bigint;
  pct: number;
  paymentCount: number;
  lastPaymentAt: number | null;
  topPayers: TopPayer[];
}

interface Props {
  invoiceId: string;
}

export default function PaymentSummaryCard({ invoiceId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stopped, setStopped] = useState(false);
  const [state, setState] = useState<AggState>({
    total: 0n,
    funded: 0n,
    pct: 0,
    paymentCount: 0,
    lastPaymentAt: null,
    topPayers: [],
  });

  const aggregatorRef = useRef<PaymentAggregator | null>(null);
  const knownCountRef = useRef(0);

  function syncState(agg: PaymentAggregator, total: bigint) {
    setState({
      total,
      funded: agg.funded,
      pct: agg.progressPct,
      paymentCount: agg.paymentCount,
      lastPaymentAt: agg.lastPaymentAt,
      topPayers: agg.topPayers.slice(0, 5),
    });
  }

  function processInvoice(inv: Invoice) {
    const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);

    if (!aggregatorRef.current) {
      aggregatorRef.current = new PaymentAggregator(total, inv.payments);
      knownCountRef.current = inv.payments.length;
      setLoading(false);
    } else {
      const newPayments = inv.payments.slice(knownCountRef.current);
      for (const p of newPayments) {
        aggregatorRef.current.applyPayment(p);
      }
      knownCountRef.current = inv.payments.length;
    }

    syncState(aggregatorRef.current, total);
  }

  useEffect(() => {
    splitClient
      .getInvoice(invoiceId)
      .then(processInvoice)
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useInterval(
    () => {
      splitClient
        .getInvoice(invoiceId)
        .then((inv) => {
          if (inv.status === "Released" || inv.status === "Refunded") {
            setStopped(true);
          }
          processInvoice(inv);
        })
        .catch(() => {});
    },
    stopped ? null : POLL_MS,
  );

  if (loading) {
    return (
      <section
        aria-label="Payment summary loading"
        className="bg-gray-900 rounded-xl p-5 mb-8"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/3" />
          <div className="h-7 bg-gray-700 rounded w-1/2" />
          <SkeletonProgress />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const { total, funded, pct, paymentCount, lastPaymentAt, topPayers } = state;

  return (
    <section
      aria-labelledby="payment-summary-heading"
      className="bg-gray-900 rounded-xl p-5 mb-8"
    >
      <h2 id="payment-summary-heading" className="text-lg font-semibold mb-4">
        Payment Summary
      </h2>

      {/* Funded total */}
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <span className="text-2xl font-bold text-indigo-300">
          {formatAmount(funded)} USDC
        </span>
        <span className="text-sm text-gray-400">
          of {formatAmount(total)} USDC
        </span>
      </div>

      {/* Animated progress bar — width driven by CSS transition to avoid layout thrash */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct.toFixed(1)}% funded`}
        className="w-full bg-gray-700 rounded-full h-3 overflow-hidden mb-4"
      >
        <div
          className="h-full bg-indigo-500 rounded-full"
          style={{ width: `${pct}%`, transition: "width 500ms ease-out" }}
        />
      </div>

      {/* Stats row */}
      <div
        className="flex items-center gap-4 text-sm text-gray-400 mb-6 flex-wrap"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>
          {paymentCount} payment{paymentCount !== 1 ? "s" : ""}
        </span>
        {lastPaymentAt !== null && (
          <span>Last: {relativeTime(lastPaymentAt)}</span>
        )}
        <span className="font-semibold text-indigo-400">
          {pct.toFixed(1)}% funded
        </span>
      </div>

      {topPayers.length === 0 ? (
        <p className="text-sm text-gray-500">No payments yet.</p>
      ) : (
        <>
          {/* Top-payer leaderboard */}
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Top Payers
          </h3>
          <ol className="space-y-2 mb-5">
            {topPayers.map((tp, i) => (
              <li
                key={tp.address}
                className={`flex items-center gap-3${i >= 3 ? " hidden sm:flex" : ""}`}
              >
                <span
                  className="w-7 text-center shrink-0"
                  aria-label={`Rank ${i + 1}`}
                >
                  {i < 3 ? (
                    <span role="img" aria-label={["Gold", "Silver", "Bronze"][i]}>
                      {RANK_BADGES[i]}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">{i + 1}</span>
                  )}
                </span>
                <span className="font-mono text-gray-300 text-sm flex-1 truncate min-w-0">
                  {truncateAddress(tp.address)}
                </span>
                <span className="text-indigo-300 text-sm shrink-0">
                  {formatAmount(tp.totalAmount)} USDC
                </span>
                <span className="text-gray-500 text-xs w-10 text-right shrink-0 hidden sm:block">
                  {tp.sharePct}%
                </span>
              </li>
            ))}
          </ol>

          {/* Mini bar chart — CSS only, no external library */}
          <div aria-hidden="true">
            <p className="text-xs text-gray-500 mb-2">Distribution</p>
            <div className="space-y-1.5">
              {topPayers.map((tp, i) => (
                <div key={tp.address} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-4 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{
                        width: `${tp.sharePct}%`,
                        opacity: Math.max(0.45, 1 - i * 0.12),
                        transition: "width 500ms ease-out",
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 shrink-0">
                    {tp.sharePct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
