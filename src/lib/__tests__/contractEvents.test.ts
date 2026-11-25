import { describe, expect, it } from "vitest";
import {
  decodeScValLike,
  validateBlockRange,
  MAX_LEDGER_RANGE,
  fetchContractEvents,
} from "../contractEvents";

describe("validateBlockRange", () => {
  it("allows empty range", () => {
    expect(validateBlockRange(undefined, undefined)).toBeNull();
  });

  it("requires from <= to", () => {
    expect(validateBlockRange(100, 50)).toMatch(/less than or equal/i);
  });

  it("allows equal bounds", () => {
    expect(validateBlockRange(10, 10)).toBeNull();
  });

  it(`rejects ranges over ${MAX_LEDGER_RANGE} ledgers`, () => {
    expect(validateBlockRange(1, 1 + MAX_LEDGER_RANGE + 1)).toMatch(/exceed/i);
  });

  it("allows exactly MAX range", () => {
    expect(validateBlockRange(100, 100 + MAX_LEDGER_RANGE)).toBeNull();
  });
});

describe("decodeScValLike", () => {
  it("stringifies plain JSON objects", () => {
    const field = decodeScValLike({ type: "contract", ok: true });
    expect(field.decoded).toBe(true);
    expect(field.display).toContain('"ok": true');
  });

  it("returns hex fallback for garbage XDR without crashing", () => {
    const field = decodeScValLike("not-valid-xdr!!!");
    expect(field.decoded).toBe(false);
    expect(field.display.startsWith("0x") || field.display.length > 0).toBe(true);
    expect(field.error).toMatch(/decode/i);
  });

  it("handles null", () => {
    const field = decodeScValLike(null);
    expect(field.display).toBe("null");
    expect(field.decoded).toBe(true);
  });
});

describe("fetchContractEvents", () => {
  it("dryRun returns empty page without network", async () => {
    const page = await fetchContractEvents({ dryRun: true, contractId: "Cdummy" });
    expect(page.events).toEqual([]);
    expect(page.cursor).toBeNull();
  });

  it("throws on invalid range before fetch", async () => {
    await expect(
      fetchContractEvents({ fromLedger: 500, toLedger: 1, dryRun: true })
    ).rejects.toThrow(/less than or equal/i);
  });
});
