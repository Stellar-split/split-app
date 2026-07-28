"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "@stellar-split/sdk";

interface Props {
  funded: bigint;
  total: bigint;
  token?: string;
  /** compact hides the text label */
  compact?: boolean;
}

function getBarColor(pct: number): string {
  if (pct === 0) return "bg-gray-500";
  if (pct < 50) return "bg-yellow-500";
  if (pct < 100) return "bg-blue-500";
  return "bg-green-500";
}

/**
 * FundingProgress — animated horizontal bar with colour transitions.
 * Animates from 0 → actual value on first render (600 ms).
 */
export default function FundingProgress({ funded, total, token = "USDC", compact = false }: Props) {
  const rawPct = total === 0n ? 0 : Number((funded * 100n) / total);
  const clamped = Math.min(100, Math.max(0, rawPct));

  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Defer so the CSS transition can animate from 0
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const label = `${formatAmount(funded)} ${token} of ${formatAmount(total)} ${token} funded (${clamped}%)`;

  return (
    <div>
      {!compact && (
        <p className="text-xs text-gray-400 mb-1">{label}</p>
      )}
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
    </div>
  );
}
