import type { Invoice } from "@stellar-split/sdk";

export type DashboardPresetId = "all" | "active" | "funded" | "refunded" | "expired" | "draft";
export type DashboardSortId = "newest" | "oldest" | "amount-desc" | "amount-asc" | "deadline";

export const SORT_OPTIONS: { id: DashboardSortId; label: string }[] = [
  { id: "newest", label: "Most Recent" },
  { id: "oldest", label: "Oldest" },
  { id: "amount-desc", label: "Amount (high–low)" },
  { id: "amount-asc", label: "Amount (low–high)" },
  { id: "deadline", label: "Deadline (soonest)" },
];

export function sortInvoices(invoices: Invoice[], sort: DashboardSortId): Invoice[] {
  const list = [...invoices];
  switch (sort) {
    case "oldest":
      return list.sort((a, b) => Number(a.id) - Number(b.id));
    case "amount-desc":
      return list.sort((a, b) => {
        const ta = a.recipients.reduce((s, r) => s + r.amount, 0n);
        const tb = b.recipients.reduce((s, r) => s + r.amount, 0n);
        return tb > ta ? 1 : tb < ta ? -1 : 0;
      });
    case "amount-asc":
      return list.sort((a, b) => {
        const ta = a.recipients.reduce((s, r) => s + r.amount, 0n);
        const tb = b.recipients.reduce((s, r) => s + r.amount, 0n);
        return ta > tb ? 1 : ta < tb ? -1 : 0;
      });
    case "deadline":
      return list.sort((a, b) => a.deadline - b.deadline);
    case "newest":
    default:
      return list.sort((a, b) => Number(b.id) - Number(a.id));
  }
}

export function filterByDateRange(
  invoices: Invoice[],
  dateFrom: string,
  dateTo: string,
): Invoice[] {
  if (!dateFrom && !dateTo) return invoices;
  const from = dateFrom ? new Date(dateFrom).getTime() / 1000 : null;
  const to = dateTo ? new Date(dateTo).getTime() / 1000 + 86400 : null;
  // Use deadline as a proxy for creation date since SDK Invoice has no createdAt
  return invoices.filter((inv) => {
    if (from && inv.deadline < from) return false;
    if (to && inv.deadline > to) return false;
    return true;
  });
}

export interface DashboardPresetDefinition {
  id: Exclude<DashboardPresetId, "all">;
  label: string;
  emptyState: string;
}

export const DASHBOARD_PRESETS: DashboardPresetDefinition[] = [
  { id: "active",   label: "Active",   emptyState: "No active invoices right now." },
  { id: "funded",   label: "Funded",   emptyState: "No funded invoices right now." },
  { id: "refunded", label: "Refunded", emptyState: "No refunded invoices." },
  { id: "expired",  label: "Expired",  emptyState: "No expired invoices right now." },
  { id: "draft",    label: "Draft",    emptyState: "No draft invoices." },
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
    case "draft":
      return (invoice as any).status === "Draft";
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
