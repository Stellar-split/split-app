"use client";

import { useEffect, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayerReputationData {
  address: string;
  /** 0-100 composite reputation score */
  score: number;
  /** Number of invoices paid */
  totalPaid: number;
  /** Number of invoices paid on time (before deadline) */
  onTimePaid: number;
  /** Number of disputes the payer was involved in */
  disputeCount: number;
  /** Number of disputes the payer won */
  disputeWins: number;
  /** Total USDC volume paid */
  volumeUsdc: string;
}

export type ReputationTier =
  | "Elite"
  | "Trusted"
  | "Established"
  | "Emerging"
  | "Untrusted";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number): {
  tier: ReputationTier;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
} {
  if (score >= 90)
    return {
      tier: "Elite",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      icon: "🏆",
    };
  if (score >= 70)
    return {
      tier: "Trusted",
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/30",
      icon: "✅",
    };
  if (score >= 50)
    return {
      tier: "Established",
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-500/30",
      icon: "⭐",
    };
  if (score >= 25)
    return {
      tier: "Emerging",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      icon: "🌱",
    };
  return {
    tier: "Untrusted",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: "⚠️",
  };
}

/**
 * Compute a composite reputation score from payment history metrics.
 * Formula:
 *   40% on-time payment rate
 *   30% dispute win rate (defaults to neutral if no disputes)
 *   20% volume component (capped at 30, scaled logarithmically)
 *   10% activity bonus (capped at 10 points for 20+ invoices)
 */
export function computePayerScore(data: Omit<PayerReputationData, "score" | "address" | "volumeUsdc">): number {
  if (data.totalPaid === 0) return 0;

  const onTimeRate = data.totalPaid > 0 ? data.onTimePaid / data.totalPaid : 0;
  const disputeWinRate =
    data.disputeCount === 0 ? 1 : data.disputeWins / data.disputeCount;

  const volumeScore = Math.min(30, data.totalPaid * 1.5);
  const activityBonus = Math.min(10, (data.totalPaid / 20) * 10);

  const raw =
    onTimeRate * 40 +
    disputeWinRate * 30 +
    volumeScore +
    activityBonus;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  // Convert color class to stroke color
  const strokeColor =
    color === "text-emerald-400"
      ? "#34d399"
      : color === "text-indigo-400"
      ? "#818cf8"
      : color === "text-sky-400"
      ? "#38bdf8"
      : color === "text-amber-400"
      ? "#fbbf24"
      : "#f87171";

  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 80 80"
      aria-hidden="true"
      role="img"
    >
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="#1f2937"
        strokeWidth="8"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x="40"
        y="36"
        textAnchor="middle"
        style={{
          fontSize: 18,
          fontWeight: 700,
          fill: strokeColor,
        }}
      >
        {score}
      </text>
      <text
        x="40"
        y="52"
        textAnchor="middle"
        style={{ fontSize: 10, fill: "#9ca3af" }}
      >
        /100
      </text>
    </svg>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col px-3 py-2.5 rounded-lg ${
        highlight ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-gray-800"
      }`}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-white mt-0.5">{value}</span>
      {sub && <span className="text-xs text-gray-500 mt-0.5">{sub}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PayerReputationDisplayProps {
  /** Payer wallet address */
  address: string;
  /**
   * Pre-computed data. If omitted the component simulates a fetch
   * (for demo / when integrated without a real backend).
   */
  data?: PayerReputationData;
  /** Whether to show the address in the header */
  showAddress?: boolean;
  /** Compact mode hides the breakdown metrics */
  compact?: boolean;
}

/**
 * PayerReputationDisplay
 *
 * Renders a payer's on-chain reputation score as a visual gauge with
 * tier badge, breakdown metrics, and an explanatory tooltip.
 *
 * Usage:
 *   <PayerReputationDisplay address="GABCDE..." />
 *
 * Or with pre-loaded data:
 *   <PayerReputationDisplay address="GABCDE..." data={reputationData} />
 */
export default function PayerReputationDisplay({
  address,
  data: externalData,
  showAddress = true,
  compact = false,
}: PayerReputationDisplayProps) {
  const [data, setData] = useState<PayerReputationData | null>(
    externalData ?? null
  );
  const [loading, setLoading] = useState(!externalData);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (externalData) {
      setData(externalData);
      setLoading(false);
      return;
    }

    // Simulate data fetch — replace with a real SDK / API call when available
    const timer = setTimeout(() => {
      const totalPaid = Math.floor(Math.random() * 40) + 1;
      const onTimePaid = Math.floor(totalPaid * (0.6 + Math.random() * 0.4));
      const disputeCount = Math.floor(Math.random() * 4);
      const disputeWins = Math.floor(disputeCount * (0.5 + Math.random() * 0.5));
      const score = computePayerScore({
        totalPaid,
        onTimePaid,
        disputeCount,
        disputeWins,
      });

      setData({
        address,
        score,
        totalPaid,
        onTimePaid,
        disputeCount,
        disputeWins,
        volumeUsdc: (totalPaid * 250).toFixed(2),
      });
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [address, externalData]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl animate-pulse"
        aria-label="Loading payer reputation…"
        aria-busy="true"
      >
        <div className="w-16 h-16 rounded-full bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-700 rounded w-1/2" />
          <div className="h-3 bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-500">
        No reputation data available for this address.
      </div>
    );
  }

  const { tier, color, bgColor, borderColor, icon } = getTier(data.score);
  const onTimeRate =
    data.totalPaid > 0
      ? Math.round((data.onTimePaid / data.totalPaid) * 100)
      : 0;
  const disputeWinRate =
    data.disputeCount > 0
      ? Math.round((data.disputeWins / data.disputeCount) * 100)
      : 100;

  const tooltipText =
    "Reputation score is computed from on-time payment rate (40%), " +
    "dispute win rate (30%), total payment volume (20%), and activity bonus (10%). " +
    "Higher scores indicate a more reliable payer.";

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${bgColor} ${borderColor} ${color}`}
        title={tooltipText}
        role="status"
        aria-label={`Payer reputation: ${data.score}/100, ${tier}`}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{tier}</span>
        <span className="opacity-70">{data.score}/100</span>
      </div>
    );
  }

  return (
    <article
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
      aria-label={`Payer reputation for ${truncateAddress(address)}`}
    >
      {/* Header band */}
      <div className={`px-5 py-4 ${bgColor} border-b ${borderColor} flex items-center justify-between gap-3`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg" aria-hidden="true">{icon}</span>
            <h3 className={`text-sm font-bold ${color}`}>{tier} Payer</h3>
          </div>
          {showAddress && (
            <p className="font-mono text-xs text-gray-400 mt-0.5 truncate" title={address}>
              {truncateAddress(address)}
            </p>
          )}
        </div>

        {/* Tooltip trigger */}
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            aria-label="Reputation score explanation"
          >
            ?
          </button>
          {showTooltip && (
            <div
              role="tooltip"
              className="absolute right-0 bottom-full mb-2 w-64 z-50 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-300 shadow-xl"
            >
              {tooltipText}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Score ring */}
          <div className="flex flex-col items-center shrink-0" role="img" aria-label={`Score: ${data.score} out of 100`}>
            <ScoreRing score={data.score} color={color} />
            <span className={`text-xs font-semibold mt-1 ${color}`}>
              {tier}
            </span>
          </div>

          {/* Metrics grid */}
          <div className="flex-1 w-full grid grid-cols-2 gap-2">
            <Metric
              label="Invoices Paid"
              value={data.totalPaid}
              highlight
            />
            <Metric
              label="On-time Rate"
              value={`${onTimeRate}%`}
              sub={`${data.onTimePaid}/${data.totalPaid} on time`}
              highlight={onTimeRate >= 80}
            />
            <Metric
              label="Volume"
              value={`${data.volumeUsdc} USDC`}
            />
            <Metric
              label="Disputes"
              value={
                data.disputeCount === 0 ? (
                  <span className="text-emerald-400">None</span>
                ) : (
                  `${data.disputeCount} (${disputeWinRate}% won)`
                )
              }
            />
          </div>
        </div>

        {/* Score breakdown bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Score breakdown</span>
            <span className={`font-semibold ${color}`}>{data.score}/100</span>
          </div>
          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                data.score >= 90
                  ? "bg-emerald-500"
                  : data.score >= 70
                  ? "bg-indigo-500"
                  : data.score >= 50
                  ? "bg-sky-500"
                  : data.score >= 25
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${data.score}%` }}
              role="progressbar"
              aria-valuenow={data.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reputation score: ${data.score} out of 100`}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </article>
  );
}
