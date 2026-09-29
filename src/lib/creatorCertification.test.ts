import { describe, it, expect } from "vitest";
import { evaluateCertification, type CertificationInput } from "./creatorCertification";

const base: CertificationInput = {
  walletVerified: false,
  kycVerified: false,
  accountAgeDays: 0,
  completedInvoices: 0,
  disputeRate: 0,
  onTimeRate: 0,
};

describe("evaluateCertification", () => {
  it("is uncertified for a new creator and targets bronze", () => {
    const r = evaluateCertification(base);
    expect(r.level).toBe("none");
    expect(r.next).toBe("bronze");
    expect(r.progress).toBeCloseTo(1 / 3);
  });

  it("awards bronze and targets silver", () => {
    const r = evaluateCertification({ ...base, walletVerified: true, completedInvoices: 3 });
    expect(r.level).toBe("bronze");
    expect(r.next).toBe("silver");
    expect(r.requirements.map((q) => q.id)).toEqual(["kyc", "invoices", "age", "disputes"]);
    expect(r.progress).toBeCloseTo(1 / 4);
  });

  it("awards silver and targets gold", () => {
    const r = evaluateCertification({
      ...base,
      walletVerified: true,
      kycVerified: true,
      completedInvoices: 20,
      accountAgeDays: 100,
    });
    expect(r.level).toBe("silver");
    expect(r.next).toBe("gold");
  });

  it("awards gold with no next tier", () => {
    const r = evaluateCertification({
      walletVerified: true,
      kycVerified: true,
      accountAgeDays: 400,
      completedInvoices: 60,
      disputeRate: 0.01,
      onTimeRate: 0.95,
    });
    expect(r.level).toBe("gold");
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
    expect(r.requirements.every((q) => q.met)).toBe(true);
  });

  it("does not skip a tier whose requirements are unmet", () => {
    // Meets every gold requirement but never verified a wallet.
    const r = evaluateCertification({
      walletVerified: false,
      kycVerified: true,
      accountAgeDays: 400,
      completedInvoices: 60,
      disputeRate: 0.01,
      onTimeRate: 0.95,
    });
    expect(r.level).toBe("none");
    expect(r.next).toBe("bronze");
  });

  it("blocks a tier when the dispute rate is too high", () => {
    const r = evaluateCertification({ ...base, walletVerified: true, completedInvoices: 10, disputeRate: 0.25 });
    expect(r.level).toBe("none");
  });
});
