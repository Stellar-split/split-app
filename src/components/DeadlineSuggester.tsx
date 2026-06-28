"use client";

import { useEffect, useState } from "react";

interface Props {
  totalAmount: string;
  recipientCount: number;
  onUseSuggestion: (days: number) => void;
}

interface HistoricalInvoice {
  total: number;
  recipientCount: number;
  fundingTime: number; // days
}

export default function DeadlineSuggester({
  totalAmount,
  recipientCount,
  onUseSuggestion,
}: Props) {
  const [suggestion, setSuggestion] = useState<number | null>(null);

  useEffect(() => {
    if (!totalAmount || recipientCount === 0) {
      setSuggestion(null);
      return;
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      setSuggestion(null);
      return;
    }

    // Get historical invoices from localStorage
    const stored = localStorage.getItem("invoiceHistory");
    const history: HistoricalInvoice[] = stored ? JSON.parse(stored) : [];

    let recommendedDays: number;

    if (history.length > 0) {
      // Filter by similar amount bracket (within 50% to 150%)
      const similar = history.filter(
        (inv) => inv.total >= amount * 0.5 && inv.total <= amount * 1.5
      );

      if (similar.length > 0) {
        // Average funding time for similar invoices
        const avgTime =
          similar.reduce((sum, inv) => sum + inv.fundingTime, 0) / similar.length;
        recommendedDays = Math.ceil(avgTime * 1.2); // Add 20% buffer
      } else {
        // Use static rules as fallback
        recommendedDays = getStaticRecommendation(amount);
      }
    } else {
      // No history, use static rules
      recommendedDays = getStaticRecommendation(amount);
    }

    setSuggestion(Math.max(1, Math.min(365, recommendedDays)));
  }, [totalAmount, recipientCount]);

  if (suggestion === null) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center justify-between bg-indigo-950 border border-indigo-700 rounded-lg px-3 py-2">
      <p className="text-sm text-indigo-200">
        Recommended: <span className="font-semibold">{suggestion} days</span>
      </p>
      <button
        type="button"
        onClick={() => onUseSuggestion(suggestion)}
        className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
      >
        Use
      </button>
    </div>
  );
}

function getStaticRecommendation(amount: number): number {
  if (amount < 100) return 3;
  if (amount < 500) return 7;
  if (amount < 1000) return 10;
  return 14;
}
