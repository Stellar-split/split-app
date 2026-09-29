export interface AccountabilityInput {
  totalInvoices: number;
  fulfilledInvoices: number;
  cancelledInvoices: number;
  disputes: number;
  disputesLost: number;
  /** Average time the creator takes to respond to payer messages, in hours. */
  avgResponseHours: number;
}

export type AccountabilityGrade = "A" | "B" | "C" | "D" | "F" | "unrated";

export interface AccountabilityResult {
  /** 0-100, or null when there is not enough history to rate the creator. */
  score: number | null;
  grade: AccountabilityGrade;
  breakdown: { fulfillment: number; disputes: number; responsiveness: number };
}

/** Minimum invoices before a creator is rated. */
export const MIN_INVOICES_FOR_SCORE = 3;

const FAST_RESPONSE_HOURS = 4;
const SLOW_RESPONSE_HOURS = 72;

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function gradeForScore(score: number): Exclude<AccountabilityGrade, "unrated"> {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Weights: fulfilment 50, disputes 30 (a lost dispute counts double), responsiveness 20.
 * Cancelled invoices count against fulfilment.
 */
export function computeAccountabilityScore(input: AccountabilityInput): AccountabilityResult {
  const total = input.totalInvoices;
  if (total < MIN_INVOICES_FOR_SCORE) {
    return { score: null, grade: "unrated", breakdown: { fulfillment: 0, disputes: 0, responsiveness: 0 } };
  }

  const fulfilledShare = clamp01((input.fulfilledInvoices - input.cancelledInvoices * 0.5) / total);
  const disputePenalty = clamp01((input.disputes + input.disputesLost) / total);
  const responseShare = clamp01(
    (SLOW_RESPONSE_HOURS - input.avgResponseHours) / (SLOW_RESPONSE_HOURS - FAST_RESPONSE_HOURS),
  );

  const breakdown = {
    fulfillment: Math.round(fulfilledShare * 50),
    disputes: Math.round((1 - disputePenalty) * 30),
    responsiveness: Math.round(responseShare * 20),
  };
  const score = breakdown.fulfillment + breakdown.disputes + breakdown.responsiveness;
  return { score, grade: gradeForScore(score), breakdown };
}
