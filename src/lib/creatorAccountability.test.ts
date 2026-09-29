import { describe, it, expect } from "vitest";
import { computeAccountabilityScore, gradeForScore, type AccountabilityInput } from "./creatorAccountability";

const perfect: AccountabilityInput = {
  totalInvoices: 20,
  fulfilledInvoices: 20,
  cancelledInvoices: 0,
  disputes: 0,
  disputesLost: 0,
  avgResponseHours: 2,
};

describe("computeAccountabilityScore", () => {
  it("is unrated below the minimum history", () => {
    const r = computeAccountabilityScore({ ...perfect, totalInvoices: 2, fulfilledInvoices: 2 });
    expect(r.score).toBeNull();
    expect(r.grade).toBe("unrated");
  });

  it("gives a perfect creator 100 / A", () => {
    const r = computeAccountabilityScore(perfect);
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A");
    expect(r.breakdown).toEqual({ fulfillment: 50, disputes: 30, responsiveness: 20 });
  });

  it("penalises cancellations against fulfilment", () => {
    // (10 - 4 * 0.5) / 20 = 0.4 -> 20 fulfilment points
    const r = computeAccountabilityScore({ ...perfect, fulfilledInvoices: 10, cancelledInvoices: 4 });
    expect(r.breakdown.fulfillment).toBe(20);
  });

  it("counts lost disputes double", () => {
    // (2 + 2) / 20 = 0.2 -> 24 dispute points
    const r = computeAccountabilityScore({ ...perfect, disputes: 2, disputesLost: 2 });
    expect(r.breakdown.disputes).toBe(24);
  });

  it("scores responsiveness linearly between 4h and 72h", () => {
    expect(computeAccountabilityScore({ ...perfect, avgResponseHours: 4 }).breakdown.responsiveness).toBe(20);
    expect(computeAccountabilityScore({ ...perfect, avgResponseHours: 38 }).breakdown.responsiveness).toBe(10);
    expect(computeAccountabilityScore({ ...perfect, avgResponseHours: 500 }).breakdown.responsiveness).toBe(0);
  });

  it("never leaves the 0-100 range for out-of-range input", () => {
    const r = computeAccountabilityScore({
      totalInvoices: 5,
      fulfilledInvoices: 50,
      cancelledInvoices: 0,
      disputes: 99,
      disputesLost: 99,
      avgResponseHours: -10,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("gradeForScore", () => {
  it("maps score boundaries to grades", () => {
    expect(gradeForScore(90)).toBe("A");
    expect(gradeForScore(89)).toBe("B");
    expect(gradeForScore(75)).toBe("B");
    expect(gradeForScore(60)).toBe("C");
    expect(gradeForScore(40)).toBe("D");
    expect(gradeForScore(39)).toBe("F");
  });
});
