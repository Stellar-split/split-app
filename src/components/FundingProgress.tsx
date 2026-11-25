"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "@stellar-split/sdk";

/**
 * A milestone can be expressed either as a percentage (0–100)
 * or as an absolute amount (bigint). When expressed as an amount,
 * it is converted to a percentage relative to `total`.
 */
export type MilestoneInput =
  | { type: "percent"; value: number; label?: string }
  | { type: "amount"; value: bigint; label?: string };

interface Props {
  funded: bigint;
  total: bigint;
  token?: string;
  /** compact hides the text label */
  compact?: boolean;
  /**
   * Optional milestone markers. Each entry renders a tick on the bar.
   * Accepts percentages or absolute amounts (converted to % internally).
   */
  milestones?: MilestoneInput[];
}

function getBarColor(pct: number): string {
  if (pct === 0) return "bg-gray-500";
  if (pct < 50) return "bg-yellow-500";
  if (pct < 100) return "bg-blue-500";
  return "bg-green-500";
}

/**
 * FundingProgress — animated horizontal bar with colour transitions
 * and optional milestone tick marks.
 * Animates from 0 → actual value on first render (600 ms).
 */
export default function FundingProgress({
  funded,
  total,
  token = "USDC",
  compact = false,
  milestones,
}: Props) {
  const rawPct = total === 0n ? 0 : Number((funded * 100n) / total);
  const clamped = Math.min(100, Math.max(0, rawPct));

  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Defer so the CSS transition can animate from 0
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const label = `${formatAmount(funded)} ${token} of ${formatAmount(total)} ${token} funded (${clamped}%)`;

  /** Resolve milestones to normalised percentage values (0–100). */
  const resolvedMilestones: Array<{ pct: number; label?: string }> =
    (milestones ?? [])
      .map((m) => {
        if (m.type === "percent") {
          return { pct: Math.min(100, Math.max(0, m.value)), label: m.label };
        }
        // amount — convert to percentage
        const pct =
          total === 0n ? 0 : Number((m.value * 100n) / total);
        return { pct: Math.min(100, Math.max(0, pct)), label: m.label };
      })
      // Filter out 0% and 100% edge markers
      .filter((m) => m.pct > 0 && m.pct < 100);

  return (
    <div>
      {!compact && (
        <p className="text-xs text-gray-400 mb-1">{label}</p>
      )}
      {/*
       * The wrapper is `relative` with `overflow-visible` so tick labels
       * can render above/below without being clipped.
       */}
      <div className="relative">
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          className="w-full bg-gray-700 rounded-full h-2 overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-[600ms] ease-out ${getBarColor(clamped)}`}
            style={{ width: `${width}%` }}
          />
        </div>

        {/* Milestone tick marks */}
        {resolvedMilestones.map((m) => {
          const reached = clamped >= m.pct;
          return (
            <div
              key={m.pct}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
            >
              {/* Tick line */}
              <div
                aria-hidden="true"
                className={`w-0.5 h-3 -mt-0.5 rounded-full transition-colors duration-300 ${
                  reached ? "bg-green-400" : "bg-gray-500"
                }`}
              />
              {/* Optional label below */}
              {m.label && (
                <span
                  className={`mt-0.5 text-[10px] leading-none whitespace-nowrap transition-colors duration-300 ${
                    reached ? "text-green-400" : "text-gray-500"
                  }`}
                >
                  {m.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
