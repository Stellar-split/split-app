/**
 * Fraud Risk Score Calculator
 *
 * Synthesizes raw anomaly signals into a composite risk rating (0-100).
 * Aggregates multiple risk indicators with configurable weights and signal breakdowns.
 */

import type { Invoice, Payment } from "@stellar-split/sdk";
import { AnomalyType, type AnomalyFlag } from "./anomalyDetector";

export type RiskTier = "low" | "medium" | "high";

export interface SignalContribution {
  signal: string;
  weight: number;
  contribution: number;
  description: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
}

export interface FraudRiskScore {
  score: number; // 0-100
  tier: RiskTier;
  signals: SignalContribution[];
  timestamp: number;
  factors?: RiskFactor[];
}

export interface FraudRiskScoreOptions {
  explain?: boolean;
}

// Risk weights (tunable)
const WEIGHTS = {
  RAPID_SUCCESSION: 35,
  FIRST_TIME_LARGE: 40,
  LARGE_AMOUNT: 15,
  UNUSUAL_PATTERN: 10,
};

const TIER_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 70,
};

/**
 * Calculate fraud risk score from anomaly flags and invoice data.
 *
 * @param invoice - The invoice to analyze
 * @param anomalyFlags - Anomalies detected for recent payments
 * @param payerHistory - Payer history across creator's invoices
 * @param options - Optional settings; pass `{ explain: true }` to attach a
 *   `factors` array describing the contributing risk factors
 * @returns FraudRiskScore with breakdown
 */
export function calculateFraudRiskScore(
  invoice: Invoice,
  anomalyFlags: AnomalyFlag[],
  payerHistory: Map<string, number> = new Map(),
  options: FraudRiskScoreOptions = {},
): FraudRiskScore {
  const signals: SignalContribution[] = [];
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Signal 1: Rapid succession anomaly
  const rapidCount = anomalyFlags.filter(
    (f) => f.type === AnomalyType.RAPID_SUCCESSION,
  ).length;
  if (rapidCount > 0) {
    // Each rapid-succession flag carries the full signal weight (capped).
    const contribution = Math.min(
      rapidCount * WEIGHTS.RAPID_SUCCESSION,
      WEIGHTS.RAPID_SUCCESSION,
    );
    signals.push({
      signal: "rapid_succession",
      weight: WEIGHTS.RAPID_SUCCESSION,
      contribution,
      description: `${rapidCount} rapid payment${rapidCount > 1 ? "s" : ""} detected`,
    });
    factors.push({
      name: "rapid_succession",
      weight: contribution,
      value: rapidCount,
    });
    totalScore += contribution;
  }

  // Signal 2: First-time large payer
  const firstTimeLargeCount = anomalyFlags.filter(
    (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
  ).length;
  if (firstTimeLargeCount > 0) {
    // Each first-time large-payer flag carries the full signal weight (capped).
    const contribution = Math.min(
      firstTimeLargeCount * WEIGHTS.FIRST_TIME_LARGE,
      WEIGHTS.FIRST_TIME_LARGE,
    );
    signals.push({
      signal: "first_time_large",
      weight: WEIGHTS.FIRST_TIME_LARGE,
      contribution,
      description: `${firstTimeLargeCount} new payer${firstTimeLargeCount > 1 ? "s" : ""} with large contribution`,
    });
    factors.push({
      name: "first_time_large",
      weight: contribution,
      value: firstTimeLargeCount,
    });
    totalScore += contribution;
  }

  // Signal 3: Invoice amount analysis
  const invoiceTotal = invoice.recipients.reduce(
    (sum, r) => sum + r.amount,
    0n,
  );
  if (invoiceTotal > 1_000_000n) {
    // Large invoice threshold (>1M stroops)
    const contribution = Math.min(
      (Number(invoiceTotal) / 1_000_000) * 5,
      WEIGHTS.LARGE_AMOUNT,
    );
    signals.push({
      signal: "large_amount",
      weight: WEIGHTS.LARGE_AMOUNT,
      contribution,
      description: `Large invoice amount (${(Number(invoiceTotal) / 1e7).toFixed(2)} XLM)`,
    });
    factors.push({
      name: "large_amount",
      weight: contribution,
      value: Number(invoiceTotal),
    });
    totalScore += contribution;
  }

  // Signal 4: Unusual payment patterns
  const hasUnusualRecipients = invoice.recipients.length > 10;
  if (hasUnusualRecipients) {
    const contribution = WEIGHTS.UNUSUAL_PATTERN;
    signals.push({
      signal: "unusual_pattern",
      weight: WEIGHTS.UNUSUAL_PATTERN,
      contribution,
      description: `High recipient count (${invoice.recipients.length} recipients)`,
    });
    factors.push({
      name: "unusual_pattern",
      weight: contribution,
      value: invoice.recipients.length,
    });
    totalScore += contribution;
  }

  // Normalize score to 0-100
  const maxPossibleScore = Object.values(WEIGHTS).reduce(
    (sum, w) => sum + w,
    0,
  );
  const normalizedScore = Math.min(100, (totalScore / maxPossibleScore) * 100);

  const result: FraudRiskScore = {
    score: Math.round(normalizedScore),
    tier: getTierFromScore(normalizedScore),
    signals,
    timestamp: Date.now(),
  };

  if (options.explain) {
    result.factors = factors.sort((a, b) => b.weight - a.weight);
  }

  return result;
}

function getTierFromScore(score: number): RiskTier {
  if (score < TIER_THRESHOLDS.LOW) return "low";
  if (score < TIER_THRESHOLDS.MEDIUM) return "medium";
  return "high";
}

/**
 * Format risk score for display
 */
export function formatRiskScore(score: FraudRiskScore): {
  scoreDisplay: string;
  tierLabel: string;
  tierColor: string;
  isHighRisk: boolean;
} {
  const tierColors: Record<RiskTier, string> = {
    low: "text-green-600",
    medium: "text-amber-600",
    high: "text-red-600",
  };

  const tierLabels: Record<RiskTier, string> = {
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
  };

  return {
    scoreDisplay: `${score.score}/100`,
    tierLabel: tierLabels[score.tier],
    tierColor: tierColors[score.tier],
    isHighRisk: score.tier === "high",
  };
}
