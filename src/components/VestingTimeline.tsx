"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";

interface Props {
  invoiceId: string;
  /** Unix timestamp (seconds) of the vesting cliff */
  vestingCliff: number;
  /** Addresses that have already claimed */
  claimed: string[];
  /** Connected wallet address */
  publicKey: string | null;
}

export default function VestingTimeline({ invoiceId, vestingCliff, claimed, publicKey }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);

  // Tick every second until cliff passes
  useEffect(() => {
    if (now >= vestingCliff) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [now, vestingCliff]);

  const cliffPassed = now >= vestingCliff;
  const cliffDate = new Date(vestingCliff * 1000);
  const hasClaimed = publicKey ? claimed.includes(publicKey) : false;

  // Progress: 0–100 from creation proxy (cliff - 30 days) to cliff
  const windowStart = vestingCliff - 30 * 24 * 3600;
  const progress = Math.min(100, Math.max(0, ((now - windowStart) / (vestingCliff - windowStart)) * 100));

  const handleClaim = async () => {
    if (!publicKey) return;
    setClaiming(true);
    setClaimError(null);
    try {
      /* eslint-disable-next-line */
      const result = await (splitClient as any).claimShare(invoiceId);
      setClaimTx(result?.txHash ?? "ok");
    } catch (err) {
      setClaimError(String(err));
    } finally {
      setClaiming(false);
    }
  };

  const cliffLabel = cliffDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const timeLeft = vestingCliff - now;
  const daysLeft = Math.floor(timeLeft / 86400);
  const hoursLeft = Math.floor((timeLeft % 86400) / 3600);

  return (
    <section aria-labelledby="vesting-heading" className="mb-8">
      <h2 id="vesting-heading" className="text-lg font-semibold mb-4">Vesting Schedule</h2>

      {/* Timeline bar with cliff marker */}
      <div className="relative pt-1 pb-8 mb-2">
        {/* Track */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
            style={{ width: `${cliffPassed ? 100 : progress}%` }}
          />
        </div>

        {/* Cliff marker dot + label — pinned at right end (cliff = end of window) */}
        <div className="absolute right-0 top-0 flex flex-col items-center" style={{ transform: "translateX(50%)" }}>
          <div
            className={`w-4 h-4 rounded-full border-2 mt-[-3px] ${
              cliffPassed ? "bg-green-500 border-green-400" : "bg-gray-800 border-indigo-400"
            }`}
          />
          <span className={`text-xs mt-1 whitespace-nowrap font-semibold ${cliffPassed ? "text-green-400" : "text-indigo-300"}`}>
            Cliff{cliffPassed ? " ✓" : ""}
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap">{cliffLabel}</span>
        </div>

        {/* Start label */}
        <span className="absolute left-0 bottom-0 text-xs text-gray-500">Start</span>
      </div>

      {/* Countdown or unlocked message */}
      {!cliffPassed && (
        <p className="text-sm text-gray-400 mb-4">
          Unlocks in{" "}
          <span className="text-white font-semibold tabular-nums">
            {daysLeft}d {hoursLeft}h
          </span>
        </p>
      )}
      {cliffPassed && !hasClaimed && (
        <p className="text-sm text-green-400 mb-4">Cliff passed — your share is unlocked.</p>
      )}
      {hasClaimed && (
        <p className="text-sm text-gray-400 mb-4 flex items-center gap-1">
          <span className="text-green-400">✓</span> You have claimed your share.
        </p>
      )}

      {/* Claim button */}
      {publicKey && !hasClaimed && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleClaim}
            disabled={!cliffPassed || claiming}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-disabled={!cliffPassed}
          >
            {claiming ? "Claiming…" : "Claim Share"}
          </button>
          {claimError && (
            <p role="alert" className="text-red-400 text-sm">{claimError}</p>
          )}
          {claimTx && (
            <p role="status" className="text-green-400 text-sm">
              Claimed! Tx: {claimTx.slice(0, 12)}…
            </p>
          )}
        </div>
      )}
    </section>
  );
}
