/**
 * Referral program tracking, reward calculation, tiers, and payouts.
 *
 * A referrer shares their referral code; when a new user signs up with that
 * code they become the referrer's referee. Each qualifying referral earns the
 * referrer a reward based on the referrer's current tier. Rewards accumulate
 * into a pending balance that can be paid out.
 */

/** Referral tiers, ordered from lowest to highest. */
export type ReferralTierId = "bronze" | "silver" | "gold" | "platinum";

export interface ReferralTier {
  id: ReferralTierId;
  /** Minimum number of successful referrals required to reach this tier. */
  minReferrals: number;
  /** Reward per successful referral, in the program's base unit. */
  rewardPerReferral: number;
}

/** Tiers sorted from lowest to highest threshold. */
export const REFERRAL_TIERS: ReferralTier[] = [
  { id: "bronze", minReferrals: 0, rewardPerReferral: 10 },
  { id: "silver", minReferrals: 5, rewardPerReferral: 15 },
  { id: "gold", minReferrals: 15, rewardPerReferral: 25 },
  { id: "platinum", minReferrals: 50, rewardPerReferral: 50 },
];

export interface ReferralRecord {
  /** The referrer who shared the code. */
  referrer: string;
  /** The new user who signed up. */
  referee: string;
  /** Referral code used at signup. */
  code: string;
  /** When the referral was recorded (epoch ms). */
  timestamp: number;
  /** Whether the referral has matured into a successful conversion. */
  qualified: boolean;
}

export interface ReferralPayout {
  id: string;
  referrer: string;
  amount: number;
  timestamp: number;
}

/** In-memory program state. */
export interface ReferralProgramState {
  referrals: ReferralRecord[];
  payouts: ReferralPayout[];
}

export function createInitialState(): ReferralProgramState {
  return { referrals: [], payouts: [] };
}

/** Return the tier for a given number of successful referrals. */
export function tierForReferralCount(count: number): ReferralTier {
  let current = REFERRAL_TIERS[0];
  for (const tier of REFERRAL_TIERS) {
    if (count >= tier.minReferrals) current = tier;
  }
  return current;
}

/**
 * Record a new referral. A referral is "qualified" (counts toward rewards)
 * only when the referee has not been seen before.
 *
 * Returns the updated state and the recorded referral.
 */
export function trackReferral(
  state: ReferralProgramState,
  referrer: string,
  referee: string,
  code: string,
  timestamp: number = Date.now()
): { state: ReferralProgramState; referral: ReferralRecord } {
  const alreadyReferred = state.referrals.some((r) => r.referee === referee);
  const referral: ReferralRecord = {
    referrer,
    referee,
    code,
    timestamp,
    qualified: !alreadyReferred,
  };
  return {
    state: { ...state, referrals: [...state.referrals, referral] },
    referral,
  };
}

/** Count of successful (qualified) referrals made by a referrer. */
export function qualifiedReferralCount(
  state: ReferralProgramState,
  referrer: string
): number {
  return state.referrals.filter(
    (r) => r.referrer === referrer && r.qualified
  ).length;
}

/**
 * Calculate the total reward a referrer has earned from qualified referrals.
 * Each qualified referral is rewarded at the rate of the tier the referrer
 * had reached at the time of that referral.
 */
export function calculateReward(
  state: ReferralProgramState,
  referrer: string
): number {
  const own = state.referrals
    .filter((r) => r.referrer === referrer)
    .sort((a, b) => a.timestamp - b.timestamp);

  let qualifiedSoFar = 0;
  let total = 0;
  for (const referral of own) {
    if (!referral.qualified) continue;
    const tier = tierForReferralCount(qualifiedSoFar);
    total += tier.rewardPerReferral;
    qualifiedSoFar += 1;
  }
  return total;
}

/** Total rewards already paid out to a referrer. */
export function paidOutTotal(
  state: ReferralProgramState,
  referrer: string
): number {
  return state.payouts
    .filter((p) => p.referrer === referrer)
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Pending (unpaid) reward balance for a referrer. */
export function pendingBalance(
  state: ReferralProgramState,
  referrer: string
): number {
  return calculateReward(state, referrer) - paidOutTotal(state, referrer);
}

let payoutCounter = 0;

/**
 * Pay out a referrer's pending balance. Returns the updated state and the
 * payout record, or null when there is nothing to pay.
 */
export function processPayout(
  state: ReferralProgramState,
  referrer: string,
  timestamp: number = Date.now()
): { state: ReferralProgramState; payout: ReferralPayout } | null {
  const amount = pendingBalance(state, referrer);
  if (amount <= 0) return null;

  payoutCounter += 1;
  const payout: ReferralPayout = {
    id: `payout-${referrer}-${timestamp}-${payoutCounter}`,
    referrer,
    amount,
    timestamp,
  };
  return {
    state: { ...state, payouts: [...state.payouts, payout] },
    payout,
  };
}

/** Summary of a referrer's standing in the program. */
export interface ReferrerSummary {
  referrer: string;
  tier: ReferralTierId;
  qualifiedReferrals: number;
  totalEarned: number;
  paidOut: number;
  pending: number;
}

export function summarizeReferrer(
  state: ReferralProgramState,
  referrer: string
): ReferrerSummary {
  const qualified = qualifiedReferralCount(state, referrer);
  return {
    referrer,
    tier: tierForReferralCount(qualified).id,
    qualifiedReferrals: qualified,
    totalEarned: calculateReward(state, referrer),
    paidOut: paidOutTotal(state, referrer),
    pending: pendingBalance(state, referrer),
  };
}