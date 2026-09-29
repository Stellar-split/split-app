import { describe, it, expect } from "vitest";
import { buildSocialProof, formatTimeAgo, maskAddress, summarizeSocialProof, type RecentPayment } from "./socialProof";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = 10 * DAY;
const ADDR_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ADDR_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZZZZ";

const pay = (over: Partial<RecentPayment> & { id: string }): RecentPayment => ({
  payer: ADDR_A,
  amount: 10,
  asset: "XLM",
  paidAt: NOW - MIN,
  ...over,
});

describe("maskAddress", () => {
  it("shortens long addresses and keeps short ones", () => {
    expect(maskAddress(ADDR_A)).toBe("GAAA…AWHF");
    expect(maskAddress(ADDR_A)).not.toContain(ADDR_A);
    expect(maskAddress("GABC")).toBe("GABC");
  });
});

describe("formatTimeAgo", () => {
  it("formats each range", () => {
    expect(formatTimeAgo(NOW - 30_000, NOW)).toBe("just now");
    expect(formatTimeAgo(NOW - 5 * MIN, NOW)).toBe("5m ago");
    expect(formatTimeAgo(NOW - 3 * HOUR, NOW)).toBe("3h ago");
    expect(formatTimeAgo(NOW - 2 * DAY, NOW)).toBe("2d ago");
  });

  it("treats future timestamps as just now", () => {
    expect(formatTimeAgo(NOW + HOUR, NOW)).toBe("just now");
  });
});

describe("buildSocialProof", () => {
  it("orders newest first, limits results and masks payers", () => {
    const items = buildSocialProof(
      [pay({ id: "old", paidAt: NOW - HOUR }), pay({ id: "new", paidAt: NOW - MIN, payer: ADDR_B, amount: 2.5 }), pay({ id: "mid", paidAt: NOW - 10 * MIN })],
      NOW,
      2,
    );
    expect(items.map((i) => i.id)).toEqual(["new", "mid"]);
    expect(items[0]).toEqual({
      id: "new",
      payerLabel: maskAddress(ADDR_B),
      amountLabel: "2.5 XLM",
      timeAgo: "1m ago",
    });
  });

  it("drops future-dated and non-positive payments", () => {
    const items = buildSocialProof([pay({ id: "future", paidAt: NOW + HOUR }), pay({ id: "zero", amount: 0 }), pay({ id: "ok" })], NOW);
    expect(items.map((i) => i.id)).toEqual(["ok"]);
  });

  it("returns an empty list for no payments", () => {
    expect(buildSocialProof([], NOW)).toEqual([]);
  });
});

describe("summarizeSocialProof", () => {
  it("counts payments and unique payers inside the window", () => {
    const s = summarizeSocialProof(
      [pay({ id: "1" }), pay({ id: "2" }), pay({ id: "3", payer: ADDR_B }), pay({ id: "4", paidAt: NOW - 2 * DAY })],
      NOW,
    );
    expect(s).toEqual({ count: 3, uniquePayers: 2 });
  });
});
