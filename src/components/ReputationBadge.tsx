"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";

interface Props {
  address: string;
}

export default function ReputationBadge({ address }: Props) {
  const [reputation, setReputation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReputation = async () => {
      try {
        // Mock reputation (in real app, would call splitClient.getReputation)
        const rep = Math.random() > 0.5 ? Math.floor(Math.random() * 100) + 1 : 0;
        setReputation(rep);
      } catch {
        setReputation(0);
      } finally {
        setLoading(false);
      }
    };

    fetchReputation();
  }, [address]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">
        ⏳
      </span>
    );
  }

  const isVerified = reputation !== null && reputation > 0;

  const tooltipText =
    "Reputation is calculated from on-time payments, dispute win rate, " +
    "and total transaction volume. Consistent, timely activity raises your score.";

  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        role="img"
        aria-label={`Reputation: ${reputation ?? 0}. ${tooltipText}`}
        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full cursor-default focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          isVerified
            ? "bg-green-900 text-green-300"
            : "bg-gray-700 text-gray-400"
        }`}
      >
        {isVerified ? "✓" : "○"}
      </span>
      {/* Tooltip: shown on hover and keyboard focus */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden w-56 rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-200 shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="block font-semibold mb-0.5">
          Reputation: {reputation ?? 0}
        </span>
        {tooltipText}
      </span>
    </span>
  );
}
