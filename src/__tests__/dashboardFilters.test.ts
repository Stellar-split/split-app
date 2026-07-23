import type { Invoice } from "@stellar-split/sdk";
import {
  DASHBOARD_PRESETS,
  filterDashboardInvoices,
  matchesDashboardPreset,
} from "@/lib/dashboardFilters";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "1",
    creator: "CREATOR",
    recipients: [{ address: "PAYER", amount: 10_000_000n }],
    token: "TOKEN",
    funded: 0n,
    deadline: Math.floor(Date.now() / 1000) + 86400,
    status: "Pending",
    payments: [],
    ...overrides,
  };
}

describe("dashboard filter presets", () => {
  const now = Math.floor(Date.now() / 1000);
  const invoices: Invoice[] = [
    makeInvoice({ id: "1", status: "Pending", deadline: now - 60 }),
    makeInvoice({ id: "2", status: "Pending", deadline: now + 86400 }),
    makeInvoice({ id: "3", status: "Pending", funded: 5_000_000n }),
    makeInvoice({ id: "4", status: "Released" }),
    makeInvoice({ id: "5", status: "Refunded" }),
  ];

  test("'active' returns pending invoices that are not expired", () => {
    const results = filterDashboardInvoices(invoices, "active", now);
    expect(results.map((i) => i.id)).toEqual(["2", "3"]);
  });

  test("'funded' returns pending invoices with funded > 0", () => {
    const results = filterDashboardInvoices(invoices, "funded", now);
    expect(results.map((i) => i.id)).toEqual(["3"]);
  });

  test("'refunded' returns refunded invoices", () => {
    const results = filterDashboardInvoices(invoices, "refunded", now);
    expect(results.map((i) => i.id)).toEqual(["5"]);
  });

  test("'expired' returns pending invoices that are past deadline", () => {
    const results = filterDashboardInvoices(invoices, "expired", now);
    expect(results.map((i) => i.id)).toEqual(["1"]);
  });

  test("'all' returns every invoice", () => {
    const results = filterDashboardInvoices(invoices, "all");
    expect(results).toHaveLength(5);
  });

  test("exposes a preset label and empty state for each preset", () => {
    expect(DASHBOARD_PRESETS.map((preset) => preset.id)).toEqual([
      "active",
      "funded",
      "refunded",
      "expired",
    ]);
    expect(DASHBOARD_PRESETS[0].emptyState.toLowerCase()).toContain("active");
    expect(DASHBOARD_PRESETS[1].emptyState.toLowerCase()).toContain("funded");
    expect(DASHBOARD_PRESETS[2].emptyState.toLowerCase()).toContain("refunded");
    expect(DASHBOARD_PRESETS[3].emptyState.toLowerCase()).toContain("expired");
  });
});
