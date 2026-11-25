import { describe, it, expect } from "vitest";
import { assessInvoiceRisk } from "./invoiceRiskAssessment";

const base = { amount: 100, recipientCount: 2, creatorAccountAgeDays: 365, priorDisputes: 0, deadlineDays: 14 };

describe("assessInvoiceRisk", () => {
  it("rates a typical invoice as low risk", () => {
    expect(assessInvoiceRisk(base)).toEqual({ score: 0, level: "low", factors: [] });
  });

  it("flags medium risk for elevated amount from a young account", () => {
    const r = assessInvoiceRisk({ ...base, amount: 5_000, creatorAccountAgeDays: 10, priorDisputes: 1, isPrivate: true });
    expect(r.level).toBe("medium");
    expect(r.factors.map((f) => f.id)).toEqual(["medium-amount", "young-account", "disputes", "private"]);
  });

  it("flags high risk and caps score at 100", () => {
    const r = assessInvoiceRisk({ amount: 50_000, recipientCount: 50, creatorAccountAgeDays: 1, priorDisputes: 5, deadlineDays: 0 });
    expect(r.level).toBe("high");
    expect(r.score).toBe(100);
  });
});
