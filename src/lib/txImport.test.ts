import { describe, it, expect } from "vitest";
import { parseTransactionOperations } from "./txImport";

describe("parseTransactionOperations", () => {
  it("maps payment operations to recipient lines", () => {
    const { recipients, ignoredOperations } = parseTransactionOperations([
      {
        type: "payment",
        to: "GRECIPIENT1",
        amount: "10.0000000",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
      },
    ]);

    expect(recipients).toEqual([{ address: "GRECIPIENT1", amount: "10.0000000", asset: "USDC" }]);
    expect(ignoredOperations).toEqual([]);
  });

  it("maps native XLM payments with an XLM asset label", () => {
    const { recipients } = parseTransactionOperations([
      { type: "payment", to: "GRECIPIENT1", amount: "5.0000000", asset_type: "native" },
    ]);

    expect(recipients).toEqual([{ address: "GRECIPIENT1", amount: "5.0000000", asset: "XLM" }]);
  });

  it("maps path payment operations", () => {
    const { recipients } = parseTransactionOperations([
      {
        type: "path_payment_strict_send",
        to: "GRECIPIENT2",
        amount: "3.0000000",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
      },
      {
        type: "path_payment_strict_receive",
        to: "GRECIPIENT3",
        amount: "7.0000000",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
      },
    ]);

    expect(recipients).toHaveLength(2);
    expect(recipients[0].address).toBe("GRECIPIENT2");
    expect(recipients[1].address).toBe("GRECIPIENT3");
  });

  it("ignores non-payment operations and reports counts by type", () => {
    const { recipients, ignoredOperations } = parseTransactionOperations([
      { type: "payment", to: "GRECIPIENT1", amount: "1.0000000", asset_type: "native" },
      { type: "change_trust" },
      { type: "change_trust" },
      { type: "manage_sell_offer" },
    ]);

    expect(recipients).toHaveLength(1);
    expect(ignoredOperations).toEqual(
      expect.arrayContaining([
        { type: "change_trust", count: 2 },
        { type: "manage_sell_offer", count: 1 },
      ])
    );
  });

  it("ignores payment-type operations missing required fields", () => {
    const { recipients, ignoredOperations } = parseTransactionOperations([
      { type: "payment", asset_type: "native" },
    ]);

    expect(recipients).toHaveLength(0);
    expect(ignoredOperations).toEqual([{ type: "payment", count: 1 }]);
  });

  it("returns no recipients and no ignored ops for an empty operation list", () => {
    const { recipients, ignoredOperations } = parseTransactionOperations([]);
    expect(recipients).toEqual([]);
    expect(ignoredOperations).toEqual([]);
  });
});
