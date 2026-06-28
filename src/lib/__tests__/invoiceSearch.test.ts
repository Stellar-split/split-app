import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchInvoices,
  getStoredSearches,
  saveSearch,
  clearSearchHistory,
} from "../invoiceSearch";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoices: Invoice[] = [
  {
    id: "1",
    creator: "GCREATOR1",
    recipients: [{ address: "GRECIPIENT1", amount: 1000n }],
    status: "Pending",
    funded: 0n,
    deadline: Date.now() / 1000,
    data: { title: "Office Supplies" },
  },
  {
    id: "42",
    creator: "GCREATOR2",
    recipients: [{ address: "GRECIPIENT2", amount: 2000n }],
    status: "Released",
    funded: 2000n,
    deadline: Date.now() / 1000,
    data: { title: "Marketing Budget" },
  },
  {
    id: "3",
    creator: "GCREATOR3",
    recipients: [{ address: "GRECIPIENT1", amount: 3000n }],
    status: "Pending",
    funded: 1500n,
    deadline: Date.now() / 1000,
    data: { title: "Team Event" },
  },
];

describe("invoiceSearch", () => {
  describe("searchInvoices", () => {
    it("should search by invoice ID", () => {
      const results = searchInvoices(mockInvoices, "42");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("42");
    });

    it("should search by title", () => {
      const results = searchInvoices(mockInvoices, "Office");
      expect(results).toHaveLength(1);
      expect(results[0].data?.title).toBe("Office Supplies");
    });

    it("should search by creator address", () => {
      const results = searchInvoices(mockInvoices, "CREATOR2");
      expect(results).toHaveLength(1);
      expect(results[0].creator).toBe("GCREATOR2");
    });

    it("should search by recipient address", () => {
      const results = searchInvoices(mockInvoices, "GRECIPIENT1");
      expect(results).toHaveLength(2);
    });

    it("should be case-insensitive", () => {
      const results = searchInvoices(mockInvoices, "marketing");
      expect(results).toHaveLength(1);
      expect(results[0].data?.title).toBe("Marketing Budget");
    });

    it("should return empty for empty query", () => {
      const results = searchInvoices(mockInvoices, "");
      expect(results).toHaveLength(0);
    });

    it("should return empty for no matches", () => {
      const results = searchInvoices(mockInvoices, "nonexistent");
      expect(results).toHaveLength(0);
    });
  });

  describe("search history", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("should save search to history", () => {
      saveSearch("test query");
      const searches = getStoredSearches();
      expect(searches).toContain("test query");
    });

    it("should limit history to 10 items", () => {
      for (let i = 0; i < 15; i++) {
        saveSearch(`query ${i}`);
      }
      const searches = getStoredSearches();
      expect(searches).toHaveLength(10);
    });

    it("should not duplicate searches", () => {
      saveSearch("query");
      saveSearch("query");
      const searches = getStoredSearches();
      expect(searches.filter((s) => s === "query")).toHaveLength(1);
    });

    it("should clear search history", () => {
      saveSearch("test");
      clearSearchHistory();
      const searches = getStoredSearches();
      expect(searches).toHaveLength(0);
    });
  });
});
