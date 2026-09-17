import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByTags,
  setTags,
  getTags,
  __resetTagStore,
  normalizeTag,
  normalizeTags,
  invoiceHasTag,
} from "../invoiceTags";
import type { Invoice } from "@stellar-split/sdk";

function createMockInvoice(id: string, tags?: string[]): Invoice {
  return {
    id,
    creator: "GCREATOR",
    recipients: [{ address: "GRECIPIENT", amount: 1000n }],
    token: "CDREXAMPLE",
    deadline: Math.floor(Date.now() / 1000) + 3600,
    funded: 0n,
    status: "Pending",
    payments: [],
    ...(tags ? { tags } : {}),
  } as unknown as Invoice;
}

describe("invoiceTags", () => {
  beforeEach(() => {
    __resetTagStore();
  });

  describe("filterByTags", () => {
    const inv1 = createMockInvoice("inv-1"); // tags: ["urgent", "operations"]
    const inv2 = createMockInvoice("inv-2"); // tags: ["operations", "audit"]
    const inv3 = createMockInvoice("inv-3"); // tags: ["marketing"]
    const inv4 = createMockInvoice("inv-4"); // tags: []

    beforeEach(() => {
      setTags("inv-1", ["urgent", "operations"]);
      setTags("inv-2", ["operations", "audit"]);
      setTags("inv-3", ["marketing"]);
      setTags("inv-4", []);
    });

    it("returns all invoices unchanged when tags array is empty", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, []);
      expect(result).toEqual(invoices);
    });

    it("returns all invoices unchanged when tags only contain whitespace or empty strings", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, ["   ", ""]);
      expect(result).toEqual(invoices);
    });

    it("filters with any-match (default matchAll: false)", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, ["urgent", "marketing"]);
      expect(result.map((i) => i.id)).toEqual(["inv-1", "inv-3"]);
    });

    it("filters with all-match (matchAll: true)", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, ["urgent", "operations"], { matchAll: true });
      expect(result.map((i) => i.id)).toEqual(["inv-1"]);
    });

    it("returns empty array when no invoices match", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, ["nonexistent-tag"]);
      expect(result).toEqual([]);
    });

    it("is case-insensitive and normalizes whitespace in search tags", () => {
      const invoices = [inv1, inv2, inv3, inv4];
      const result = filterByTags(invoices, ["  URGENT  "]);
      expect(result.map((i) => i.id)).toEqual(["inv-1"]);
    });

    it("works with tags directly attached to the invoice object", () => {
      const attached1 = createMockInvoice("custom-1", ["finance", "tax"]);
      const attached2 = createMockInvoice("custom-2", ["tax"]);
      const attached3 = createMockInvoice("custom-3", ["engineering"]);

      const list = [attached1, attached2, attached3];
      const anyTax = filterByTags(list, ["tax"]);
      expect(anyTax.map((i) => i.id)).toEqual(["custom-1", "custom-2"]);

      const allTaxFinance = filterByTags(list, ["tax", "finance"], { matchAll: true });
      expect(allTaxFinance.map((i) => i.id)).toEqual(["custom-1"]);
    });
  });

  describe("normalization & lookup", () => {
    it("normalizes single tag", () => {
      expect(normalizeTag("  HELLO   World  ")).toBe("hello world");
    });

    it("normalizes tag list and drops duplicates", () => {
      expect(normalizeTags(["tag1", "TAG1", "  tag2  ", ""])).toEqual(["tag1", "tag2"]);
    });

    it("checks tag presence case-insensitively", () => {
      expect(invoiceHasTag(["Product", "Design"], "product")).toBe(true);
      expect(invoiceHasTag(["Product", "Design"], "marketing")).toBe(false);
    });
  });
});
