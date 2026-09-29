export interface RecentPayment {
  id: string;
  payer: string; // Stellar address
  amount: number;
  asset: string;
  paidAt: number; // ms since epoch
}

export interface SocialProofItem {
  id: string;
  payerLabel: string;
  amountLabel: string;
  timeAgo: string;
}

export interface SocialProofSummary {
  count: number;
  uniquePayers: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Shortens an address for display (never shows a full wallet address). */
export function maskAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  return `${Math.floor(diff / DAY_MS)}d ago`;
}

/** Most recent payments first, with masked payers, ready to display. */
export function buildSocialProof(payments: RecentPayment[], now: number = Date.now(), limit = 5): SocialProofItem[] {
  return [...payments]
    .filter((p) => p.paidAt <= now && p.amount > 0)
    .sort((a, b) => b.paidAt - a.paidAt)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      payerLabel: maskAddress(p.payer),
      amountLabel: `${p.amount} ${p.asset}`,
      timeAgo: formatTimeAgo(p.paidAt, now),
    }));
}

/** Counts payments (and distinct payers) within the trailing window. */
export function summarizeSocialProof(
  payments: RecentPayment[],
  now: number = Date.now(),
  windowMs: number = DAY_MS,
): SocialProofSummary {
  const recent = payments.filter((p) => p.paidAt <= now && now - p.paidAt <= windowMs && p.amount > 0);
  return { count: recent.length, uniquePayers: new Set(recent.map((p) => p.payer)).size };
}
