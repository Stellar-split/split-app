import type { Invoice } from "@stellar-split/sdk";

export type DashboardPresetId = "all" | "active" | "funded" | "refunded" | "expired";

export interface DashboardPresetDefinition {
  id: Exclude<DashboardPresetId, "all">;
  label: string;
  emptyState: string;
}

export const DASHBOARD_PRESETS: DashboardPresetDefinition[] = [
  {
    id: "active",
    label: "Active",
    emptyState: "No active invoices right now.",
  },
  {
    id: "funded",
    label: "Funded",
    emptyState: "No funded invoices right now.",
  },
  {
    id: "refunded",
    label: "Refunded",
    emptyState: "No refunded invoices.",
  },
  {
    id: "expired",
    label: "Expired",
    emptyState: "No expired invoices right now.",
  },
];

export function matchesDashboardPreset(
  invoice: Invoice,
  preset: DashboardPresetId,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (preset === "all") return true;

  switch (preset) {
    case "active":
      return invoice.status === "Pending" && invoice.deadline > now;
    case "funded":
      return invoice.status === "Pending" && invoice.funded > 0n;
    case "refunded":
      return invoice.status === "Refunded";
    case "expired":
      return invoice.status === "Pending" && invoice.deadline <= now;
    default:
      return false;
  }
}

export function filterDashboardInvoices(
  invoices: Invoice[],
  preset: DashboardPresetId,
  now = Math.floor(Date.now() / 1000),
): Invoice[] {
  return invoices.filter((invoice) =>
    matchesDashboardPreset(invoice, preset, now),
  );
}

export function getDashboardPresetCounts(
  invoices: Invoice[],
  now = Math.floor(Date.now() / 1000),
): Record<Exclude<DashboardPresetId, "all">, number> {
  return DASHBOARD_PRESETS.reduce(
    (counts, preset) => {
      counts[preset.id] = invoices.filter((invoice) =>
        matchesDashboardPreset(invoice, preset.id, now),
      ).length;
      return counts;
    },
    {} as Record<Exclude<DashboardPresetId, "all">, number>,
  );
}
