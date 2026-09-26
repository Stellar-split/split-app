"use client";

import { formatAmount } from "@stellar-split/sdk";

interface Props {
  cap: bigint;
  remaining: bigint;
  paid: bigint;
  entered?: bigint;
  token?: string;
  className?: string;
}

export default function ContributionCapBadge({
  cap,
  remaining,
  paid,
  entered = 0n,
  token = "USDC",
  className = "",
}: Props) {
  const currentPct = cap > 0n ? Math.min(100, Number((paid * 10000n) / cap) / 100) : 0;
  const newPaid = paid + entered;
  const newPct = cap > 0n ? Math.min(100, Number((newPaid * 10000n) / cap) / 100) : 0;
  const isCapReached = remaining === 0n;

  return (
    <div
      role="status"
      aria-label={`Contribution cap: ${formatAmount(cap)} ${token}, ${formatAmount(remaining)} remaining`}
      className={`rounded-xl border p-3 text-xs flex flex-col gap-2 ${
        isCapReached
          ? "bg-amber-950/40 border-amber-800/50 text-amber-200"
          : "bg-indigo-950/40 border-indigo-800/50 text-indigo-200"
      } ${className}`}
    >
      <div className="flex items-center justify-between font-medium">
        <span>
          Your limit: <strong className="text-white">{formatAmount(cap)} {token}</strong>
        </span>
        <span className={isCapReached ? "text-amber-400 font-bold" : "text-indigo-300 font-bold"}>
          {formatAmount(remaining)} remaining
        </span>
      </div>

      {/* Progress bar relative to cap */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden flex">
        <div
          className="bg-indigo-500 h-full transition-all duration-300"
          style={{ width: `${currentPct}%` }}
        />
        {entered > 0n && (
          <div
            className="bg-indigo-300 h-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100 - currentPct, newPct - currentPct))}%` }}
          />
        )}
      </div>

      <div className="flex justify-between text-[11px] text-gray-400">
        <span>Contributed: {formatAmount(paid)} {token} ({currentPct.toFixed(0)}%)</span>
        {entered > 0n && (
          <span>After payment: {newPct.toFixed(0)}% of cap</span>
        )}
      </div>
    </div>
  );
}
