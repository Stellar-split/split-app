import { describe, it, expect } from "vitest";
import { optimizePortfolio, type PortfolioInvoice } from "./portfolioOptimization";

const DAY = 86_400_000;
const NOW = 100 * DAY;

const inv = (over: Partial<PortfolioInvoice> & { id: string }): PortfolioInvoice => ({
  title: over.id,
  amount: 100,
  status: "open",
  recipients: ["GA"],
  createdAt: NOW - DAY,
  ...over,
});

const ids = (tips: ReturnType<typeof optimizePortfolio>) => tips.map((t) => t.id);

describe("optimizePortfolio", () => {
  it("returns nothing for an empty portfolio", () => {
    expect(optimizePortfolio([], NOW)).toEqual([]);
  });

  it("flags overdue and soon-due open invoices, most urgent first", () => {
    const tips = optimizePortfolio(
      [
        inv({ id: "a", recipients: ["GA"], dueAt: NOW - DAY }),
        inv({ id: "b", recipients: ["GB"], dueAt: NOW + 2 * DAY }),
        inv({ id: "c", recipients: ["GC"], dueAt: NOW + 10 * DAY }),
      ],
      NOW,
    );
    expect(ids(tips)).toEqual(["overdue", "expiring"]);
    expect(tips[0].invoiceIds).toEqual(["a"]);
    expect(tips[1].invoiceIds).toEqual(["b"]);
  });

  it("ignores due dates on invoices that are not open", () => {
    const tips = optimizePortfolio([inv({ id: "a", status: "paid", dueAt: NOW - DAY })], NOW);
    expect(tips).toEqual([]);
  });

  it("flags stale open invoices that have no deadline", () => {
    const tips = optimizePortfolio([inv({ id: "old", createdAt: NOW - 45 * DAY }), inv({ id: "new" })], NOW);
    expect(ids(tips)).toEqual(["stale"]);
    expect(tips[0].invoiceIds).toEqual(["old"]);
  });

  it("flags recipient concentration above 50% of active value", () => {
    const tips = optimizePortfolio(
      [
        inv({ id: "a", recipients: ["GA"] }),
        inv({ id: "b", recipients: ["GA"] }),
        inv({ id: "c", recipients: ["GB"], amount: 50 }),
      ],
      NOW,
    );
    expect(ids(tips)).toEqual(["concentration"]);
    expect(tips[0].message).toContain("80%");
    expect(tips[0].invoiceIds).toEqual(["a", "b"]);
  });

  it("does not flag concentration for balanced recipients or tiny portfolios", () => {
    expect(
      ids(optimizePortfolio([inv({ id: "a", recipients: ["GA"] }), inv({ id: "b", recipients: ["GB"] }), inv({ id: "c", recipients: ["GC"] })], NOW)),
    ).toEqual([]);
    expect(ids(optimizePortfolio([inv({ id: "a" }), inv({ id: "b" })], NOW))).toEqual([]);
  });

  it("suggests batching three or more small open invoices", () => {
    const tips = optimizePortfolio(
      [
        inv({ id: "a", amount: 2, recipients: ["GA"] }),
        inv({ id: "b", amount: 3, recipients: ["GB"] }),
        inv({ id: "c", amount: 4, recipients: ["GC"] }),
      ],
      NOW,
    );
    expect(ids(tips)).toEqual(["small-invoices"]);
  });

  it("flags a high cancellation rate", () => {
    const list = [
      inv({ id: "a", status: "cancelled" }),
      inv({ id: "b", status: "cancelled" }),
      inv({ id: "c", status: "paid" }),
      inv({ id: "d", status: "paid" }),
      inv({ id: "e", status: "paid" }),
    ];
    const tips = optimizePortfolio(list, NOW);
    expect(ids(tips)).toEqual(["cancellations"]);
    expect(tips[0].message).toContain("40%");
  });
});
