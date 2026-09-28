import { describe, it, expect } from "vitest";
import { getTrustBadges, getTrustTier } from "./creatorVerification";

const base = { emailVerified: false, walletVerified: false, kycVerified: false, accountAgeDays: 0, completedInvoices: 0, disputeRate: 0 };

describe("creatorVerification", () => {
  it("returns no badges and unverified tier for a new profile", () => {
    expect(getTrustBadges(base)).toEqual([]);
    expect(getTrustTier(base)).toBe("unverified");
  });

  it("marks wallet-verified creators as verified", () => {
    expect(getTrustTier({ ...base, walletVerified: true })).toBe("verified");
  });

  it("marks fully verified reliable creators as trusted", () => {
    const p = { emailVerified: true, walletVerified: true, kycVerified: true, accountAgeDays: 365, completedInvoices: 20, disputeRate: 0 };
    expect(getTrustBadges(p).map((b) => b.id)).toEqual(["email", "wallet", "kyc", "established", "reliable"]);
    expect(getTrustTier(p)).toBe("trusted");
  });

  it("withholds the reliable badge when dispute rate is high", () => {
    expect(getTrustBadges({ ...base, completedInvoices: 20, disputeRate: 0.2 })).toEqual([]);
  });
});
