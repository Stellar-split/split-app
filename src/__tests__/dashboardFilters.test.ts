import type { Invoice } from "@stellar-split/sdk";
import {
  DASHBOARD_PRESETS,
  filterDashboardInvoices,
  type DashboardInvoice,
} from "@/lib/dashboardFilters";

function makeInvoice(overrides: Partial<DashboardInvoice> = {}): DashboardInvoice {
  return {
    id: "1",
    creator: "CREATOR",
    recipients: [{ address: "PAYER", amount: 10_000_000n }],
    funded: 0n,
    deadline: Math.floor(Date.now() / 1000) + 86400,
    status: "Pending",
    approved: false,
    approver: "APPROVER",
    ...overrides,
  } as DashboardInvoice;
}

describe("dashboard filter presets", () => {
  const now = Math.floor(Date.now() / 1000);
  const invoices: DashboardInvoice[] = [
    makeInvoice({ id: "1", deadline: now - 60, approver: "ME", approved: false }),
    makeInvoice({ id: "2", approver: "ME", approved: false, deadline: now + 86400 }),
    makeInvoice({ id: "3", recipients: [{ address: "ME", amount: 10_000_000n }] }),
    makeInvoice({ id: "4", approver: "OTHER", approved: false }),
    makeInvoice({ id: "5", approver: "ME", approved: true }),
  ];

  test("returns the overdue invoice subset", () => {
    const results = filterDashboardInvoices(invoices, "ME", "overdue", "", now);
    expect(results.map((invoice) => invoice.id)).toEqual(["1"]);
  });

  test("returns invoices awaiting the current wallet payment", () => {
    const results = filterDashboardInvoices(invoices, "ME", "awaiting-payment", "", now);
    expect(results.map((invoice) => invoice.id)).toEqual(["3"]);
  });

  test("returns invoices that need the current wallet approval", () => {
    const results = filterDashboardInvoices(invoices, "ME", "needs-approval", "", now);
    expect(results.map((invoice) => invoice.id)).toEqual(["2"]);
  });

  test("exposes a preset label and empty state for each preset", () => {
    expect(DASHBOARD_PRESETS.map((preset) => preset.id)).toEqual([
      "overdue",
      "awaiting-payment",
      "needs-approval",
    ]);
    expect(DASHBOARD_PRESETS[0].emptyState).toContain("overdue");
    expect(DASHBOARD_PRESETS[1].emptyState).toContain("payment");
    expect(DASHBOARD_PRESETS[2].emptyState).toContain("approval");
  });
});
