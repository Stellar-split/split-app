import { describe, it, expect } from "vitest";
import {
  filterAndSortInvoices,
  filterStateToUrl,
  urlToFilterState,
  DEFAULT_FILTERS,
} from "../invoiceFilters";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoices: Invoice[] = [
  {
    id: "1",
    creator: "GCREATOR1",
    recipients: [
      { address: "GRECIPIENT1", amount: 1000n },
      { address: "GRECIPIENT2", amount: 2000n },
    ],
    status: "Pending",
    funded: 0n,
    deadline: Math.floor(Date.now() / 1000) + 86400,
    data: {},
  },
  {
    id: "2",
    creator: "GCREATOR2",
    recipients: [{ address: "GRECIPIENT1", amount: 5000n }],
    status: "Released",
    funded: 5000n,
    deadline: Math.floor(Date.now() / 1000) - 86400,
    data: {},
  },
  {
    id: "3",
    creator: "GCREATOR1",
    recipients: [{ address: "GRECIPIENT3", amount: 3000n }],
    status: "Pending",
    funded: 1500n,
    deadline: Math.floor(Date.now() / 1000) + 172800,
    data: {},
  },
];

describe("invoiceFilters", () => {
  describe("filterAndSortInvoices", () => {
    it("should filter by status", () => {
      const result = filterAndSortInvoices(mockInvoices, {
        ...DEFAULT_FILTERS,
        status: "Pending",
      }, "GCREATOR1");
      expect(result).toHaveLength(2);
      expect(result.every((inv) => inv.status === "Pending")).toBe(true);
    });

    it("should filter by role Created", () => {
      const result = filterAndSortInvoices(
        mockInvoices,
        { ...DEFAULT_FILTERS, role: "Created" },
        "GCREATOR1"
      );
      expect(result).toHaveLength(2);
      expect(result.every((inv) => inv.creator === "GCREATOR1")).toBe(true);
    });

    it("should filter by role Received", () => {
      const result = filterAndSortInvoices(
        mockInvoices,
        { ...DEFAULT_FILTERS, role: "Received" },
        "GRECIPIENT1"
      );
      expect(result).toHaveLength(2);
      expect(
        result.every((inv) =>
          inv.recipients.some((r) => r.address === "GRECIPIENT1")
        )
      ).toBe(true);
    });

    it("should sort by newest", () => {
      const result = filterAndSortInvoices(
        mockInvoices,
        { ...DEFAULT_FILTERS, sort: "newest" },
        "GCREATOR1"
      );
      expect(result[0].id).toBe("3");
    });

    it("should sort by amount-high", () => {
      const result = filterAndSortInvoices(
        mockInvoices,
        { ...DEFAULT_FILTERS, sort: "amount-high" },
        "GCREATOR1"
      );
      const total1 = result[0].recipients.reduce((s, r) => s + r.amount, 0n);
      const total2 = result[1].recipients.reduce((s, r) => s + r.amount, 0n);
      expect(total1 >= total2).toBe(true);
    });

    it("should sort by deadline (soonest)", () => {
      const result = filterAndSortInvoices(
        mockInvoices,
        { ...DEFAULT_FILTERS, sort: "deadline" },
        "GCREATOR1"
      );
      expect(result[0].deadline <= result[1].deadline).toBe(true);
    });
  });

  describe("filterStateToUrl", () => {
    it("should convert filter state to URL params", () => {
      const filters = {
        status: "Pending" as const,
        role: "Received" as const,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        sort: "amount-high" as const,
      };
      const url = filterStateToUrl(filters);
      expect(url.get("status")).toBe("Pending");
      expect(url.get("role")).toBe("Received");
      expect(url.get("startDate")).toBe("2024-01-01");
      expect(url.get("sort")).toBe("amount-high");
    });

    it("should omit default values", () => {
      const url = filterStateToUrl(DEFAULT_FILTERS);
      expect(url.toString()).toBe("");
    });
  });

  describe("urlToFilterState", () => {
    it("should parse URL params to filter state", () => {
      const params = new URLSearchParams(
        "status=Pending&role=Received&sort=amount-high"
      );
      const filters = urlToFilterState(params);
      expect(filters.status).toBe("Pending");
      expect(filters.role).toBe("Received");
      expect(filters.sort).toBe("amount-high");
    });

    it("should default to default filters", () => {
      const params = new URLSearchParams("");
      const filters = urlToFilterState(params);
      expect(filters).toEqual(DEFAULT_FILTERS);
    });
  });
});
