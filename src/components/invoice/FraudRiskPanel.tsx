"use client";

import { useState, useEffect } from "react";
import type { Invoice, Payment } from "@stellar-split/sdk";
import type { AnomalyFlag } from "@/lib/anomalyDetector";
import {
  calculateFraudRiskScore,
  formatRiskScore,
  type FraudRiskScore,
} from "@/lib/fraudRiskScorer";

interface Props {
  invoice: Invoice;
  anomalyFlags?: AnomalyFlag[];
  onHighRiskConfirm?: () => void;
  className?: string;
}

/**
 * FraudRiskPanel — displays fraud risk assessment for an invoice
 *
 * Shows a score gauge, tier classification, and expandable signal breakdown table.
 * High-risk invoices (score > 70) can trigger a confirmation requirement.
 */
export default function FraudRiskPanel({
  invoice,
  anomalyFlags = [],
  onHighRiskConfirm,
  className = "",
}: Props) {
  const [riskScore, setRiskScore] = useState<FraudRiskScore | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const score = calculateFraudRiskScore(invoice, anomalyFlags);
    setRiskScore(score);
  }, [invoice, anomalyFlags]);

  if (!riskScore) return null;

  const formatted = formatRiskScore(riskScore);
  const isHighRisk = formatted.isHighRisk;

  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      {/* Header with score gauge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Fraud Risk Assessment
        </h3>

        {/* Score gauge */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            {/* Circular gauge background */}
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Risk score arc */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={
                  riskScore.tier === "high"
                    ? "#dc2626"
                    : riskScore.tier === "medium"
                      ? "#ea580c"
                      : "#16a34a"
                }
                strokeWidth="8"
                strokeDasharray={`${(riskScore.score / 100) * 282.7} 282.7`}
                strokeLinecap="round"
              />
            </svg>
            {/* Score text in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${formatted.tierColor}`}>
                {riskScore.score}
              </span>
              <span className="text-xs text-gray-500">out of 100</span>
            </div>
          </div>

          <div>
            <p className={`font-semibold ${formatted.tierColor}`}>
              {formatted.tierLabel}
            </p>
            {isHighRisk && (
              <p className="text-sm text-red-600 font-medium mt-1">
                ⚠️ Requires confirmation
              </p>
            )}
          </div>
        </div>
      </div>

      {/* High-risk warning banner */}
      {isHighRisk && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            ⚠️ High fraud risk detected. Please review the signals below before
            proceeding with payment.
          </p>
        </div>
      )}

      {/* Signal breakdown */}
      <div className="mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <span className="text-lg">
            {expanded ? "▼" : "▶"}
          </span>
          Signal Breakdown ({riskScore.signals.length})
        </button>

        {expanded && riskScore.signals.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Signal
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Weight
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Contribution
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {riskScore.signals.map((sig, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-2 px-2 text-gray-900 dark:text-gray-100 font-mono">
                      {sig.signal.replace(/_/g, " ")}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">
                      {sig.weight}
                    </td>
                    <td className="text-right py-2 px-2 font-semibold text-gray-900 dark:text-gray-100">
                      +{sig.contribution.toFixed(1)}
                    </td>
                    <td className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">
                      {sig.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {expanded && riskScore.signals.length === 0 && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            ✓ No risk signals detected. This invoice appears normal.
          </p>
        )}
      </div>

      {/* High-risk confirmation gate (shown but non-blocking for display) */}
      {isHighRisk && onHighRiskConfirm && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onHighRiskConfirm}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Confirm high-risk payment
          </button>
        </div>
      )}
    </div>
  );
}
