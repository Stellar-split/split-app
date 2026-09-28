import { rateCardTotal, toLineItems, type RateCardItem } from "@/lib/rateCard";
import { summarizeEarnings } from "@/lib/recipientEarnings";
import { computeImpact } from "@/lib/invoiceImpact";
import { predictPayment } from "@/lib/paymentPrediction";

describe("rateCard", () => {
  const items: RateCardItem[] = [
    { id: "1", service: "Design", rate: 50, unit: "hour", quantity: 3 },
    { id: "2", service: "", rate: 10, unit: "item", quantity: 1 },
  ];
  it("totals line items", () => expect(rateCardTotal(items)).toBe(160));
  it("converts valid items to line items", () => {
    expect(toLineItems(items)).toEqual([{ description: "Design (3 hours)", amount: 150 }]);
  });
});

describe("summarizeEarnings", () => {
  it("aggregates by asset and month", () => {
    const s = summarizeEarnings([
      { invoiceId: "a", amount: 10, asset: "XLM", paidAt: "2026-01-05T00:00:00Z" },
      { invoiceId: "b", amount: 30, asset: "USDC", paidAt: "2026-02-05T00:00:00Z" },
      { invoiceId: "c", amount: 20, asset: "XLM", paidAt: "2026-01-20T00:00:00Z" },
    ]);
    expect(s.total).toBe(60);
    expect(s.average).toBe(20);
    expect(s.byAsset).toEqual({ XLM: 30, USDC: 30 });
    expect(s.byMonth).toEqual([{ month: "2026-01", total: 30 }, { month: "2026-02", total: 30 }]);
  });
  it("handles empty input", () => expect(summarizeEarnings([]).average).toBe(0));
});

describe("computeImpact", () => {
  it("measures outcomes", () => {
    const m = computeImpact([
      { status: "funded", target: 100, raised: 100, createdAt: "2026-01-01T00:00:00Z", fundedAt: "2026-01-03T00:00:00Z", payers: 4 },
      { status: "expired", target: 100, raised: 50, createdAt: "2026-01-01T00:00:00Z", payers: 2 },
    ]);
    expect(m.completionRate).toBe(0.5);
    expect(m.fundingRatio).toBe(0.75);
    expect(m.avgDaysToFund).toBe(2);
    expect(m.avgPayers).toBe(3);
  });
  it("returns zeros for no invoices", () => expect(computeImpact([]).avgDaysToFund).toBeNull());
});

describe("predictPayment", () => {
  const now = Date.parse("2026-01-11T00:00:00Z");
  it("is likely when on pace for the deadline", () => {
    const p = predictPayment({ target: 100, raised: 50, createdAt: "2026-01-01T00:00:00Z", deadline: "2026-01-31T00:00:00Z", now });
    expect(p.label).toBe("likely");
    expect(p.estimatedCompletion).toBe("2026-01-21T00:00:00.000Z");
  });
  it("is unlikely when behind pace", () => {
    const p = predictPayment({ target: 100, raised: 5, createdAt: "2026-01-01T00:00:00Z", deadline: "2026-01-13T00:00:00Z", now });
    expect(p.label).toBe("unlikely");
  });
  it("is 0 after the deadline", () => {
    expect(predictPayment({ target: 100, raised: 5, createdAt: "2026-01-01T00:00:00Z", deadline: "2026-01-10T00:00:00Z", now }).probability).toBe(0);
  });
  it("is 1 when fully funded", () => {
    expect(predictPayment({ target: 100, raised: 100, createdAt: "2026-01-01T00:00:00Z", now }).probability).toBe(1);
  });
});
