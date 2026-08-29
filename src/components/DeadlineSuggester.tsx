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
  const [reason, setReason] = useState<string>("");
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    if (!totalAmount || recipientCount === 0) {
      setSuggestion(null);
      setReason("");
      return;
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      setSuggestion(null);
      setReason("");
      return;
    }

    // Get historical invoices from localStorage
    const stored = localStorage.getItem("invoiceHistory");
    const history: HistoricalInvoice[] = stored ? JSON.parse(stored) : [];

    let recommendedDays: number;
    let recommendationReason: string;

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
        recommendationReason = `Based on your average payment cycle of ${avgTime.toFixed(
          1
        )} days for ${similar.length} similar invoice${similar.length === 1 ? "" : "s"}, plus a 20% buffer.`;
      } else {
        // Use static rules as fallback
        recommendedDays = getStaticRecommendation(amount);
        recommendationReason = `No similar past invoices found, so we used a standard recommendation for invoices around $${amount.toFixed(
          2
        )}.`;
      }
    } else {
      // No history, use static rules
      recommendedDays = getStaticRecommendation(amount);
      recommendationReason = `You have no invoice history yet, so we used a standard recommendation for invoices around $${amount.toFixed(
        2
      )}.`;
    }

    setSuggestion(Math.max(1, Math.min(365, recommendedDays)));
    setReason(recommendationReason);
  }, [totalAmount, recipientCount]);

  if (suggestion === null) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center justify-between bg-indigo-950 border border-indigo-700 rounded-lg px-3 py-2">
      <p className="text-sm text-indigo-200 flex items-center gap-1">
        Recommended: <span className="font-semibold">{suggestion} days</span>
        <span className="relative inline-flex">
          <button
            type="button"
            aria-label="Why this suggestion?"
            aria-describedby="deadline-suggestion-reason"
            onFocus={() => setTooltipOpen(true)}
            onBlur={() => setTooltipOpen(false)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full border border-indigo-400 text-[10px] leading-none text-indigo-300 hover:bg-indigo-800"
          >
            ?
          </button>
          {tooltipOpen && (
            <span
              id="deadline-suggestion-reason"
              role="tooltip"
              className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1.5 text-xs text-gray-100 shadow-lg"
            >
              {reason}
            </span>
          )}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onUseSuggestion(suggestion)}
        className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
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
