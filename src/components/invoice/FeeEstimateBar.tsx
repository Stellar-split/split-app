"use client";

import { useFeeEstimate, FALLBACK_BASE_FEE } from "@/hooks/useFeeEstimate";

interface Props {
  /** Number of operations in the transaction; fees scale linearly. */
  operationCount?: number;
}

const STROOPS_PER_XLM = 10_000_000;

interface Tier {
  id: "economy" | "standard" | "priority";
  label: string;
  description: string;
  stroopsPerOp: number;
  segmentClass: string;
}

function toXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toFixed(7);
}

/**
 * FeeEstimateBar (#411) — shows live network fees across three tiers with a
 * segmented bar visualization, scaled by the operation count of the invoice
 * transaction being built.
 */
export default function FeeEstimateBar({ operationCount = 1 }: Props) {
  const { baseFee, medianFee, p90Fee, loading, error } = useFeeEstimate();

  if (loading) {
    return (
      <div className="fee-bar rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400" role="status">
          Loading fee estimates…
        </p>
      </div>
    );
  }

  const ops = Math.max(1, operationCount);
  const economy = baseFee ?? FALLBACK_BASE_FEE;
  const standard = Math.max(economy, medianFee ?? economy);
  const priority = Math.max(standard, p90Fee ?? standard);

  const tiers: Tier[] = [
    {
      id: "economy",
      label: "Economy",
      description: "Slowest confirmation, base network fee",
      stroopsPerOp: economy,
      segmentClass: "bg-emerald-500",
    },
    {
      id: "standard",
      label: "Standard",
      description: "Median network fee, typical confirmation time",
      stroopsPerOp: standard,
      segmentClass: "bg-indigo-500",
    },
    {
      id: "priority",
      label: "Priority",
      description: "90th percentile fee, fastest confirmation",
      stroopsPerOp: priority,
      segmentClass: "bg-amber-500",
    },
  ];

  const maxTotal = tiers[tiers.length - 1].stroopsPerOp * ops;

  return (
    <div className="fee-bar rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
      {error && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400" role="alert">
          Error loading live fee stats. Showing fallback estimates.
        </p>
      )}

      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Network fees shown in stroops with XLM equivalents (1 XLM = 10,000,000
        base units), scaled to {ops} operation{ops === 1 ? "" : "s"}.
      </p>

      {/* Segmented bar visualization */}
      <div
        className="fee-bar-track mb-4 flex h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        aria-hidden="true"
      >
        {tiers.map((tier) => (
          <span
            key={tier.id}
            className={`fee-bar-segment h-full ${tier.segmentClass}`}
            style={{
              width: `${maxTotal > 0 ? (tier.stroopsPerOp * ops * 100) / maxTotal : 33.33}%`,
            }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tiers.map((tier) => {
          const totalStroops = tier.stroopsPerOp * ops;
          return (
            <li
              key={tier.id}
              title={tier.description}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
            >
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                {tier.label}
              </span>
              <span className="block text-sm font-mono text-gray-900 dark:text-gray-100">
                {totalStroops}
              </span>
              <span className="block text-xs font-mono text-gray-500 dark:text-gray-400">
                {toXlm(totalStroops)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
