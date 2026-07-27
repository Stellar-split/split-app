import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  archiveInvoices,
  unarchiveInvoices,
  getArchivedInvoices,
  isInvoiceArchived,
  clearArchiveHistory,
  filterByArchiveStatus,
} from "./archiveInvoices";

describe("archiveInvoices", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    clearArchiveHistory();
  });

  it("should archive invoices", () => {
    const ids = ["inv1", "inv2"];
    const archived = archiveInvoices(ids);

    expect(archived).toHaveLength(2);
    expect(archived[0].id).toBe("inv1");
    expect(archived[0].wasArchived).toBe(true);
  });

  it("should mark invoices as archived in storage", () => {
    archiveInvoices(["inv1", "inv2"]);
    const archived = getArchivedInvoices();

    expect(archived["inv1"]).toBeDefined();
    expect(archived["inv2"]).toBeDefined();
  });

  it("should unarchive invoices", () => {
    archiveInvoices(["inv1", "inv2"]);
    const unarchived = unarchiveInvoices(["inv1"]);

    expect(unarchived).toHaveLength(1);
    expect(unarchived[0].id).toBe("inv1");
    expect(unarchived[0].wasArchived).toBe(false);
  });

  it("should remove unarchived invoices from storage", () => {
    archiveInvoices(["inv1", "inv2"]);
    unarchiveInvoices(["inv1"]);

    const archived = getArchivedInvoices();
    expect(archived["inv1"]).toBeUndefined();
    expect(archived["inv2"]).toBeDefined();
  });

  it("should check if invoice is archived", () => {
    archiveInvoices(["inv1"]);

    expect(isInvoiceArchived("inv1")).toBe(true);
    expect(isInvoiceArchived("inv2")).toBe(false);
  });

  it("should filter invoices by archive status", () => {
    const invoices = [
      { id: "inv1" },
      { id: "inv2" },
      { id: "inv3" },
    ];

    archiveInvoices(["inv1", "inv2"]);

    const archived = filterByArchiveStatus(invoices, true);
    const active = filterByArchiveStatus(invoices, false);

    expect(archived).toHaveLength(2);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("inv3");
  });

  it("should clear archive history", () => {
    archiveInvoices(["inv1", "inv2"]);
    clearArchiveHistory();

    const archived = getArchivedInvoices();
    expect(Object.keys(archived)).toHaveLength(0);
  });
});
