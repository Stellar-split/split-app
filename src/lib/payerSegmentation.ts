export interface PayerRecord {
  address: string;
  totalPaid: number;
  paymentCount: number;
  firstPaidAt: string;
  lastPaidAt: string;
}

export type PayerSegmentId = "champions" | "loyal" | "new" | "at-risk" | "lapsed" | "casual";

export interface SegmentedPayer extends PayerRecord {
  segment: PayerSegmentId;
  recencyDays: number;
}

export interface SegmentSummary {
  segment: PayerSegmentId;
  label: string;
  description: string;
  count: number;
  totalPaid: number;
  share: number;
}

export const SEGMENT_DEFINITIONS: { id: PayerSegmentId; label: string; description: string }[] = [
  { id: "champions", label: "Champions", description: "Paid recently, often and in high volume." },
  { id: "loyal", label: "Loyal", description: "Pay repeatedly and recently." },
  { id: "new", label: "New", description: "First payment in the last 30 days." },
  { id: "casual", label: "Casual", description: "Paid recently but only occasionally." },
  { id: "at-risk", label: "At risk", description: "Used to pay but quiet for 30 to 90 days." },
  { id: "lapsed", label: "Lapsed", description: "No payment for more than 90 days." },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_WINDOW_DAYS = 30;
const AT_RISK_AFTER_DAYS = 30;
const LAPSED_AFTER_DAYS = 90;
const LOYAL_MIN_PAYMENTS = 3;
const CHAMPION_MIN_PAYMENTS = 5;

function daysBetween(fromIso: string, now: number): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return Infinity;
  return Math.max(0, Math.floor((now - from) / DAY_MS));
}

/**
 * Assigns one segment to a payer. `championMinTotal` is the total paid a payer
 * needs, on top of frequency and recency, to count as a champion.
 */
export function classifyPayer(
  payer: PayerRecord,
  now: number,
  championMinTotal: number,
): PayerSegmentId {
  const recency = daysBetween(payer.lastPaidAt, now);
  if (recency > LAPSED_AFTER_DAYS) return "lapsed";
  if (recency > AT_RISK_AFTER_DAYS) return "at-risk";
  if (daysBetween(payer.firstPaidAt, now) <= NEW_WINDOW_DAYS && payer.paymentCount < LOYAL_MIN_PAYMENTS) {
    return "new";
  }
  if (payer.paymentCount >= CHAMPION_MIN_PAYMENTS && payer.totalPaid >= championMinTotal) return "champions";
  if (payer.paymentCount >= LOYAL_MIN_PAYMENTS) return "loyal";
  return "casual";
}

/** The champion spend threshold is the 75th percentile of total paid across payers. */
export function championThreshold(payers: PayerRecord[]): number {
  if (payers.length === 0) return 0;
  const sorted = payers.map((p) => p.totalPaid).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75) - 1);
  return sorted[idx];
}

export function segmentPayers(payers: PayerRecord[], now: number = Date.now()): SegmentedPayer[] {
  const threshold = championThreshold(payers);
  return payers.map((p) => ({
    ...p,
    segment: classifyPayer(p, now, threshold),
    recencyDays: daysBetween(p.lastPaidAt, now),
  }));
}

export function summarizeSegments(segmented: SegmentedPayer[]): SegmentSummary[] {
  const total = segmented.length;
  return SEGMENT_DEFINITIONS.map((def) => {
    const members = segmented.filter((p) => p.segment === def.id);
    return {
      segment: def.id,
      label: def.label,
      description: def.description,
      count: members.length,
      totalPaid: members.reduce((sum, p) => sum + p.totalPaid, 0),
      share: total === 0 ? 0 : members.length / total,
    };
  });
}
