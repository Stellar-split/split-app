import { describe, expect, it } from "vitest";
import {
  classifyAttributionChannel,
  compareAttributionModels,
  summarizeAttribution,
  type PaymentConversion,
  type PaymentTouchpoint,
} from "./paymentAttribution";

const conversion: PaymentConversion = {
  id: "tx-1",
  invoiceId: "invoice-1",
  timestamp: 10_000,
  amount: 120,
  currency: "USDC",
  channel: "wallet",
};

const touchpoints: PaymentTouchpoint[] = [
  { id: "visit-1", invoiceId: "invoice-1", timestamp: 1_000, channel: "email", type: "visit" },
  { id: "visit-2", invoiceId: "invoice-1", timestamp: 5_000, channel: "social", type: "visit" },
  { id: "method-1", invoiceId: "invoice-1", timestamp: 9_000, channel: "wallet", type: "payment-method" },
];

describe("payment attribution", () => {
  it("classifies campaign, search, and direct channels", () => {
    expect(classifyAttributionChannel({ source: "spring-email", medium: "email" })).toBe("email");
    expect(classifyAttributionChannel({ referrer: "https://www.google.com/search" })).toBe("organic-search");
    expect(classifyAttributionChannel({})).toBe("direct");
  });

  it("compares first, last, linear, position-based, and time-decay models", () => {
    const summaries = compareAttributionModels([conversion], touchpoints);
    expect(summaries.map((summary) => summary.model)).toEqual([
      "first-touch",
      "last-touch",
      "linear",
      "position-based",
      "time-decay",
    ]);
    summaries.forEach((summary) => {
      expect(summary.totalRevenue).toBe(120);
      expect(summary.channels.reduce((sum, channel) => sum + channel.attributedRevenue, 0)).toBeCloseTo(120);
    });
    expect(summaries[0].channels[0].channel).toBe("email");
    expect(summaries[1].channels[0].channel).toBe("wallet");
  });

  it("uses the confirmed payment channel when no earlier touchpoint exists", () => {
    const result = summarizeAttribution([conversion], [], "last-touch");
    expect(result.channels).toEqual([
      expect.objectContaining({ channel: "wallet", attributedRevenue: 120, share: 100 }),
    ]);
  });
});