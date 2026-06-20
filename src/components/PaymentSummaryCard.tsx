"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice, Payment } from "@stellar-split/sdk";

const POLL_MS = 10_000;
const TOKEN_DECIMALS = 7;

interface PayerSummary {
  payer: string;
  total: bigint;
}

interface PaymentSummaryCardProps {
  invoiceId: string;
}

/**
 * Simple payment aggregator that tracks payments and computes payer totals.
 */
class PaymentAggregator {
  private payments: Payment[];
  private payerMap: Map<string, PayerSummary>;

  constructor(initialPayments: Payment[]) {
    this.payments = [...initialPayments];
    this.payerMap = new Map();
    for (const p of this.payments) {
      const existing = this.payerMap.get(p.payer);
      if (existing) {
        existing.total += p.amount;
      } else {
        this.payerMap.set(p.payer, {
          payer: p.payer,
          total: p.amount,
        });
      }
    }
  }

  applyPayment(payment: Payment): void {
    this.payments.push(payment);
    const existing = this.payerMap.get(payment.payer);
    if (existing) {
      existing.total += payment.amount;
    } else {
      this.payerMap.set(payment.payer, {
        payer: payment.payer,
        total: payment.amount,
      });
    }
  }

  getTopPayers(limit: number = 5): PayerSummary[] {
    return Array.from(this.payerMap.values())
      .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
      .slice(0, limit);
  }

  getTotalFunded(): bigint {
    return this.payments.reduce((sum, p) => sum + p.amount, 0n);
  }

  getPaymentCount(): number {
    return this.payments.length;
  }
}

const RANK_BADGES = ["🥇", "🥈", "🥉"];

const BAR_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a78bfa", // purple
  "#c4b5fd", // light purple
  "#ddd6fe", // very light purple
];

function formatTokenAmount(stroops: bigint): string {
  const divisor = BigInt(10 ** TOKEN_DECIMALS);
  const whole = stroops / divisor;
  const fraction = stroops % divisor;
  const fractionStr = fraction.toString().padStart(TOKEN_DECIMALS, "0").slice(0, 2);
  return whole.toLocaleString() + "." + fractionStr;
}

function SkeletonCard(): JSX.Element {
  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-6 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-1/2 mb-4" />
      <div className="h-2 bg-gray-700 rounded-full mb-3" />
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
        <div className="h-4 bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function PaymentSummaryCard({ invoiceId }: PaymentSummaryCardProps): JSX.Element {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [aggregator, setAggregator] = useState<PaymentAggregator | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const data = await splitClient.getInvoice(invoiceId);
      setInvoice(data);
      setAggregator(new PaymentAggregator(data.payments));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    }
  }, [invoiceId]);

  // Initial fetch
  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await splitClient.getInvoice(invoiceId);
        setInvoice(data);
        setAggregator(new PaymentAggregator(data.payments));
      } catch {
        // Silently ignore poll errors — keep last known state
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [invoiceId]);

  // Compute derived values
  const totalAmount = useMemo(() => {
    if (!invoice) return 0n;
    return invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  }, [invoice]);

  const funded = invoice?.funded ?? 0n;
  const pct = totalAmount === 0n ? 0 : Number((funded * 100n) / totalAmount);
  const clampedPct = Math.min(100, Math.max(0, pct));

  const topPayers = aggregator?.getTopPayers(5) ?? [];
  const paymentCount = aggregator?.getPaymentCount() ?? 0;

  // Bar chart data: each payer's share of total funded
  const chartData = useMemo(() => {
    if (topPayers.length === 0 || funded === 0n) return [];
    return topPayers.map((p) => ({
      payer: p.payer,
      truncated: truncateAddress(p.payer),
      pct: Number((p.total * 100n) / funded),
      amount: p.total,
    }));
  }, [topPayers, funded]);

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!invoice || !aggregator) {
    return <SkeletonCard />;
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-6">
      {/* Header */}
      <h3 className="text-lg font-semibold text-white mb-3">Payment Summary</h3>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={clampedPct + "% funded"}
        className="w-full bg-gray-700 rounded-full h-3 overflow-hidden mb-2"
      >
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: clampedPct + "%" }}
        />
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-4">
        <span>
          <span className="text-white font-medium">{formatTokenAmount(funded)}</span>
          {" / "}
          {formatTokenAmount(totalAmount)} USDC
        </span>
        <span>{clampedPct}% funded</span>
        <span>{paymentCount} payment{paymentCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Mini bar chart — SVG only, no external library */}
      {chartData.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Payment Distribution</p>
          <div className="space-y-1.5">
            {chartData.map((bar, idx) => (
              <div key={bar.payer} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-20 sm:w-24 truncate shrink-0">
                  {bar.truncated}
                </span>
                <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: Math.max(bar.pct, 1) + "%",
                      backgroundColor: BAR_COLORS[idx % 5],
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                  {bar.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top-payer leaderboard */}
      {topPayers.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Top Payers</p>
          <ol className="space-y-1.5">
            {topPayers.map((p, idx) => (
              <li
                key={p.payer}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-5 text-center shrink-0">
                  {idx < 3 ? RANK_BADGES[idx] : <span className="text-gray-600">{idx + 1}</span>}
                </span>
                <span className="text-gray-300 font-mono truncate flex-1">
                  {truncateAddress(p.payer)}
                </span>
                <span className="text-gray-400 shrink-0">
                  {formatTokenAmount(p.total)} USDC
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {topPayers.length === 0 && (
        <p className="text-sm text-gray-500">No payments yet</p>
      )}
    </div>
  );
}
