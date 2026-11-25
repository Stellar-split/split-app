import { describe, it, expect } from "vitest";
import {
  createInitialState,
  trackReferral,
  calculateReward,
  qualifiedReferralCount,
  tierForReferralCount,
  REFERRAL_TIERS,
  processPayout,
  pendingBalance,
  paidOutTotal,
  summarizeReferrer,
} from "@/lib/referralProgramTracking";

const REFERRER = "GREFERRER";
const REFEREE_1 = "GREFEREE1";
const REFEREE_2 = "GREFEREE2";
const CODE = "SAVE10";

describe("referralProgramTracking", () => {
  it("tracks referrals and marks first-time referees as qualified", () => {
    let state = createInitialState();
    const first = trackReferral(state, REFERRER, REFEREE_1, CODE, 1000);
    state = first.state;
    expect(first.referral.qualified).toBe(true);
    expect(state.referrals).toHaveLength(1);

    // Same referee again — not qualified.
    const dup = trackReferral(state, REFERRER, REFEREE_1, CODE, 2000);
    state = dup.state;
    expect(dup.referral.qualified).toBe(false);
    expect(qualifiedReferralCount(state, REFERRER)).toBe(1);
  });

  it("calculates rewards using the tier at the time of each referral", () => {
    let state = createInitialState();
    // 5 bronze referrals (10 each) reach silver.
    for (let i = 0; i < 5; i++) {
      state = trackReferral(state, REFERRER, `GREF${i}`, CODE, 1000 + i).state;
    }
    // 6th referral now earns silver rate (15).
    state = trackReferral(state, REFERRER, "GREFX", CODE, 2000).state;

    // 5 * 10 + 1 * 15 = 65
    expect(calculateReward(state, REFERRER)).toBe(65);
  });

  it("supports tiers based on qualified referral count", () => {
    expect(tierForReferralCount(0).id).toBe("bronze");
    expect(tierForReferralCount(5).id).toBe("silver");
    expect(tierForReferralCount(15).id).toBe("gold");
    expect(tierForReferralCount(50).id).toBe("platinum");
    expect(tierForReferralCount(999).id).toBe("platinum");
    // Tiers are ordered ascending by threshold.
    for (let i = 1; i < REFERRAL_TIERS.length; i++) {
      expect(REFERRAL_TIERS[i].minReferrals).toBeGreaterThan(
        REFERRAL_TIERS[i - 1].minReferrals
      );
    }
  });

  it("handles payouts and tracks pending balance", () => {
    let state = createInitialState();
    for (let i = 0; i < 3; i++) {
      state = trackReferral(state, REFERRER, `GREF${i}`, CODE, 1000 + i).state;
    }
    // 3 bronze referrals = 30.
    expect(pendingBalance(state, REFERRER)).toBe(30);

    const result = processPayout(state, REFERRER, 5000);
    expect(result).not.toBeNull();
    state = result!.state;
    expect(result!.payout.amount).toBe(30);
    expect(paidOutTotal(state, REFERRER)).toBe(30);
    expect(pendingBalance(state, REFERRER)).toBe(0);

    // Nothing left to pay.
    expect(processPayout(state, REFERRER, 6000)).toBeNull();
  });

  it("summarizes a referrer's standing", () => {
    let state = createInitialState();
    for (let i = 0; i < 5; i++) {
      state = trackReferral(state, REFERRER, `GREF${i}`, CODE, 1000 + i).state;
    }
    state = processPayout(state, REFERRER, 9000)!.state;

    const summary = summarizeReferrer(state, REFERRER);
    expect(summary.qualifiedReferrals).toBe(5);
    expect(summary.tier).toBe("silver");
    expect(summary.totalEarned).toBe(50);
    expect(summary.paidOut).toBe(50);
    expect(summary.pending).toBe(0);
  });
});