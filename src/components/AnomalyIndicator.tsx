"use client";

import { useState } from "react";
import type { AnomalyFlag } from "@/lib/anomalyDetector";
import { formatAnomalyTooltip } from "@/lib/anomalyDetector";

interface Props {
  /** Anomaly flags to display. Empty array means no indicator shown. */
  flags: AnomalyFlag[];
  /** Optional custom CSS class for the icon container */
  className?: string;
}

/**
 * AnomalyIndicator — displays a warning icon with tooltip for suspicious payment patterns.
 *
 * Purely visual indicator, informational only. Never blocks or rejects payments.
 * Clicking or hovering reveals the tooltip explaining why the payment was flagged.
 *
 * @example
 * const flags = detectAnomalies(payment, invoice, payerHistory);
 * <AnomalyIndicator flags={flags} className="ml-2" />
 */
export default function AnomalyIndicator({ flags, className = "" }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (flags.length === 0) {
    return null; // No indicators to show
  }

  const tooltip = formatAnomalyTooltip(flags);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Warning icon */}
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`Anomaly detected: ${tooltip.replace(/\n/g, "; ")}`}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors"
        title={tooltip}
      >
        {/* Triangle warning symbol */}
        <svg
          className="w-3.5 h-3.5 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Tooltip — shown on hover or click */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-yellow-100 text-xs rounded-lg shadow-lg whitespace-pre-wrap pointer-events-none z-50 max-w-xs border border-yellow-600/30">
          {tooltip}
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
