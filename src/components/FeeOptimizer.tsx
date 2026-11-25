"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { formatAmount } from "@stellar-split/sdk";

interface FeeEstimate {
  stroops: bigint;
  usdc: string;
  congestion: "Low" | "Medium" | "High";
}

interface FeeOptimizerProps {
  /** Current fee set on the transaction form, in stroops. */
  currentFee?: bigint;
  /** Called with the suggested fee (in stroops) when the user accepts it. */
  onAcceptFee?: (stroops: bigint) => void;
}

export default function FeeOptimizer({ currentFee, onAcceptFee }: FeeOptimizerProps = {}) {
  const [fee, setFee] = useState<FeeEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [appliedFee, setAppliedFee] = useState<bigint | null>(null);

  const fetchFee = async () => {
    try {
      setLoading(true);
      // Mock fee estimate (in stroops)
      const estimate = BigInt(Math.floor(Math.random() * 5000) + 500);
      
      // Determine congestion level based on fee
      let congestion: "Low" | "Medium" | "High" = "Low";
      if (estimate > 1000n) congestion = "Medium";
      if (estimate > 3000n) congestion = "High";

      setFee({
        stroops: estimate,
        usdc: formatAmount(estimate),
        congestion,
      });
      setLastUpdate(new Date());
    } catch {
      setFee(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFee();
    const interval = setInterval(fetchFee, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !fee) {
    return (
      <div className="bg-gray-900 rounded-lg px-4 py-3 text-sm text-gray-400">
        Loading fee estimate…
      </div>
    );
  }

  const congestionColor = {
    Low: "bg-green-900 text-green-300",
    Medium: "bg-yellow-900 text-yellow-300",
    High: "bg-red-900 text-red-300",
  };

  const congestionIcon = {
    Low: "🟢",
    Medium: "🟡",
    High: "🔴",
  };

  const effectiveCurrentFee = currentFee ?? appliedFee;
  const suggestionAccepted = effectiveCurrentFee === fee.stroops;

  const handleAcceptSuggestion = () => {
    setAppliedFee(fee.stroops);
    onAcceptFee?.(fee.stroops);
  };

  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Network Congestion</span>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${congestionColor[fee.congestion]}`}>
          {congestionIcon[fee.congestion]} {fee.congestion}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Estimated Fee</span>
        <span className="text-sm font-mono text-indigo-300">{fee.usdc} USDC</span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
        <span className="text-xs text-gray-500">
          {fee.congestion === "Low" && "✓ Good time to pay"}
          {fee.congestion === "Medium" && "⏳ Consider waiting"}
          {fee.congestion === "High" && "⚠ High fees — wait if possible"}
        </span>
        <div className="flex items-center gap-2">
          {!suggestionAccepted && (
            <button
              type="button"
              onClick={handleAcceptSuggestion}
              className="text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 transition-colors"
            >
              Accept Suggestion
            </button>
          )}
          <button
            type="button"
            onClick={fetchFee}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
      {lastUpdate && (
        <p className="text-xs text-gray-600 text-right">
          Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
        </p>
      )}
    </div>
  );
}
