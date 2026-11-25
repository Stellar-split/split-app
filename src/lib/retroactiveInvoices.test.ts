import { describe, it, expect, beforeEach } from "vitest";
import {
  generateRetroactiveInvoiceId,
  isRetroactiveInvoiceId,
  saveRetroactiveInvoice,
  getRetroactiveInvoice,
  listRetroactiveInvoiceIds,
  type RetroactiveInvoice,
} from "./retroactiveInvoices";

function makeRecord(id: string): RetroactiveInvoice {
  return {
    id,
    creator: "GCREATOR",
    recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    token: "USDC",
    deadline: 0,
    funded: 100_000_000n,
    status: "Released",
    payments: [{ payer: "GCREATOR", amount: 100_000_000n }],
    retroactive: true,
    sourceTxHash: "a".repeat(64),
    memo: "invoice #123",
    createdAt: new Date().toISOString(),
  };
}

describe("retroactiveInvoices", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates ids that are recognised as retroactive", () => {
    const id = generateRetroactiveInvoiceId("a".repeat(64));
    expect(isRetroactiveInvoiceId(id)).toBe(true);
    expect(isRetroactiveInvoiceId("42")).toBe(false);
  });

  it("round-trips bigint fields through save/get", () => {
    const record = makeRecord(generateRetroactiveInvoiceId("b".repeat(64)));
    saveRetroactiveInvoice(record);

    const loaded = getRetroactiveInvoice(record.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.funded).toBe(100_000_000n);
    expect(loaded?.recipients[0].amount).toBe(100_000_000n);
    expect(loaded?.payments[0].amount).toBe(100_000_000n);
    expect(loaded?.memo).toBe("invoice #123");
  });

  it("returns null for an unknown id", () => {
    expect(getRetroactiveInvoice("retro-nonexistent")).toBeNull();
  });

  it("lists multiple saved invoice ids", () => {
    const a = makeRecord(generateRetroactiveInvoiceId("c".repeat(64)));
    const b = makeRecord(generateRetroactiveInvoiceId("d".repeat(64)));
    saveRetroactiveInvoice(a);
    saveRetroactiveInvoice(b);

    const ids = listRetroactiveInvoiceIds();
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });
});
