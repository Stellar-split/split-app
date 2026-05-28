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

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${
        isVerified
          ? "bg-green-900 text-green-300"
          : "bg-gray-700 text-gray-400"
      }`}
      title={`Reputation: ${reputation ?? 0}`}
    >
      {isVerified ? "✓" : "○"}
    </span>
  );
}
