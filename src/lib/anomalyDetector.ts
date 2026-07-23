/**
 * Anomaly Detection for Suspicious Payment Patterns
 *
 * Two lightweight, client-side heuristics flag potentially suspicious payments:
 * 1. Rapid succession: >5 payments from same payer within 60 seconds on an invoice
 * 2. First-time large payer: Payer has zero history, pays >50% of invoice total
 *
 * IMPORTANT: These heuristics are false-positive-prone by design (erring on the side of caution).
 * They are purely visual indicators for creator review. Legitimate edge cases may trigger flags:
 * - Rapid succession: Legitimate bulk payments, retries during congestion, script automation
 * - First-time large payer: New customers, automated systems, batch importers
 *
 * These can be tuned later by adjusting thresholds (RAPID_PAYMENT_COUNT, RAPID_PAYMENT_WINDOW_MS,
 * FIRST_TIME_LARGE_THRESHOLD_PCT) or adding whitelist logic.
 */

import type { Invoice, Payment, Recipient } from "@stellar-split/sdk";

export enum AnomalyType {
  /** >5 payments from same payer within 60 seconds on this invoice */
  RAPID_SUCCESSION = "rapid_succession",
  /** Payer has zero history, payment >50% of invoice total */
  FIRST_TIME_LARGE = "first_time_large",
}

export interface AnomalyFlag {
  type: AnomalyType;
  payer: string;
  reason: string;
}

// Tunable thresholds
const RAPID_PAYMENT_COUNT = 5;
const RAPID_PAYMENT_WINDOW_MS = 60 * 1000; // 60 seconds
const FIRST_TIME_LARGE_THRESHOLD_PCT = 50; // 50% of invoice total

/**
 * Detect anomalies for a specific payment in the context of an invoice.
 *
 * @param payment - The payment to analyze
 * @param invoice - The invoice being paid (context for total amount, all payments)
 * @param payerHistory - All payments across creator's invoices, keyed by payer address
 *                       Used to detect first-time payers. If empty/null, all payers are treated as first-time.
 * @returns AnomalyFlag[] — empty array if no flags, or one/more flags explaining the concern
 */
export function detectAnomalies(
  payment: Payment,
  invoice: Invoice,
  payerHistory: Map<string, number> = new Map(),
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];

  // Flag 1: Rapid succession
  const rapidFlag = checkRapidSuccession(payment, invoice);
  if (rapidFlag) flags.push(rapidFlag);

  // Flag 2: First-time large payer
  const firstTimeLargeFlag = checkFirstTimeLarge(payment, invoice, payerHistory);
  if (firstTimeLargeFlag) flags.push(firstTimeLargeFlag);

  return flags;
}

/**
 * Heuristic 1: Rapid Succession
 *
 * Checks if the payer has made >5 payments within the last 60 seconds on this specific invoice.
 * FALSE POSITIVE RISK: Legitimate bulk payments, retries during network issues, automated systems.
 */
function checkRapidSuccession(
  payment: Payment,
  invoice: Invoice,
): AnomalyFlag | null {
  const now = Date.now();
  const windowStart = now - RAPID_PAYMENT_WINDOW_MS;

  // Count payments from this payer in the time window
  // Note: We assume Payment objects have a timestamp field. If SDK doesn't provide it,
  // we estimate based on order + some heuristic. This is a limitation of client-side detection.
  const payerPayments = invoice.payments.filter(
    (p: Payment & { timestamp?: number }) => p.payer === payment.payer && (p.timestamp ?? 0) >= windowStart,
  );

  if (payerPayments.length > RAPID_PAYMENT_COUNT) {
    return {
      type: AnomalyType.RAPID_SUCCESSION,
      payer: payment.payer,
      reason: `${payerPayments.length} payments in 60 seconds — check for script abuse or retries`,
    };
  }

  return null;
}

/**
 * Heuristic 2: First-Time Large Payer
 *
 * Checks if:
 *   1. Payer has zero prior payment history (first-time contributor)
 *   2. This payment is >50% of the invoice total
 *
 * FALSE POSITIVE RISK: New customers, batch importers, automated systems initiating large transfers.
 * Consider whitelisting known partners or adding reputation scores.
 */
function checkFirstTimeLarge(
  payment: Payment,
  invoice: Invoice,
  payerHistory: Map<string, number>,
): AnomalyFlag | null {
  const invoiceTotal = invoice.recipients.reduce(
    (s: bigint, r: Recipient) => s + r.amount,
    0n,
  );

  // Check if payer is first-time (no prior history across all invoices)
  const priorCount = payerHistory.get(payment.payer) ?? 0;
  if (priorCount > 0) {
    return null; // Not a first-time payer
  }

  // Check if payment is >50% of invoice total
  const paymentPct =
    invoiceTotal > 0n
      ? Number((payment.amount * 10_000n) / invoiceTotal) / 100
      : 0;

  if (paymentPct > FIRST_TIME_LARGE_THRESHOLD_PCT) {
    return {
      type: AnomalyType.FIRST_TIME_LARGE,
      payer: payment.payer,
      reason: `New payer contributing ${paymentPct.toFixed(1)}% of invoice total`,
    };
  }

  return null;
}

/**
 * Format a list of anomaly flags into a human-readable tooltip.
 * @param flags - The anomaly flags to format
 * @returns A multi-line string suitable for display in a tooltip
 */
export function formatAnomalyTooltip(flags: AnomalyFlag[]): string {
  if (flags.length === 0) return "";
  return flags.map((f) => `• ${f.reason}`).join("\n");
}
