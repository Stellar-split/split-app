import type { Invoice } from "@stellar-split/sdk";

export type DashboardPresetId =
  | "all"
  | "overdue"
  | "awaiting-payment"
  | "needs-approval";

export type DashboardInvoice = Invoice & {
  approved?: boolean;
  approver?: string;
};

export interface DashboardPresetDefinition {
  id: Exclude<DashboardPresetId, "all">;
  label: string;
  emptyState: string;
}

export const DASHBOARD_PRESETS: DashboardPresetDefinition[] = [
  {
    id: "overdue",
    label: "Overdue",
    emptyState: "No invoices are overdue right now.",
  },
  {
    id: "awaiting-payment",
    label: "Awaiting my payment",
    emptyState: "Nothing is awaiting your payment right now.",
  },
  {
    id: "needs-approval",
    label: "Needs my approval",
    emptyState: "Nothing is waiting for your approval right now.",
  },
];

export function matchesDashboardPreset(
  invoice: DashboardInvoice,
  publicKey: string | null | undefined,
  preset: DashboardPresetId,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (preset === "all") return true;

  if (invoice.status !== "Pending") return false;

  switch (preset) {
    case "overdue":
      return (
        typeof invoice.deadline === "number" &&
        invoice.deadline > 0 &&
        invoice.deadline < now &&
        Boolean(invoice.approver) &&
        invoice.approved === false
      );
    case "awaiting-payment":
      return invoice.recipients.some((recipient) => recipient.address === publicKey);
    case "needs-approval":
      return invoice.approver === publicKey && invoice.approved === false;
    default:
      return false;
  }
}

export function matchesTextSearch(invoice: DashboardInvoice, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (/^\d+$/.test(trimmed)) {
    return String(invoice.id) === trimmed;
  }

  const haystack = trimmed.toLowerCase();
  return invoice.recipients.some((recipient) =>
    recipient.address.toLowerCase().includes(haystack),
  );
}

/**
 * Lifecycle status as shown in the status filter chips. The SDK's
 * Invoice.status only has 3 real values (Pending/Released/Refunded); these
 * 5 are derived from status + funded + deadline so users can filter by a
 * more useful lifecycle view. "Refunded" invoices don't get a dedicated
 * chip (edge case, always visible under "All") and there's no "Draft"
 * concept since every fetched invoice already exists on-chain.
 */
export type InvoiceStatusFilter = "Pending" | "Funded" | "Partial" | "Released" | "Expired";

export const INVOICE_STATUS_FILTERS: InvoiceStatusFilter[] = [
  "Pending",
  "Funded",
  "Partial",
  "Released",
  "Expired",
];

export function getInvoiceDisplayStatus(
  invoice: DashboardInvoice,
  now = Math.floor(Date.now() / 1000),
): InvoiceStatusFilter | "Refunded" {
  if (invoice.status === "Released") return "Released";
  if (invoice.status === "Refunded") return "Refunded";

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  if (invoice.deadline > 0 && invoice.deadline < now) return "Expired";
  if (total > 0n && invoice.funded >= total) return "Funded";
  if (invoice.funded > 0n) return "Partial";
  return "Pending";
}

export function matchesStatusFilter(
  invoice: DashboardInvoice,
  selectedStatuses: InvoiceStatusFilter[],
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (selectedStatuses.length === 0) return true;
  return selectedStatuses.includes(getInvoiceDisplayStatus(invoice, now) as InvoiceStatusFilter);
}

export function filterDashboardInvoices(
  invoices: DashboardInvoice[],
  publicKey: string | null | undefined,
  preset: DashboardPresetId,
  query: string,
  now = Math.floor(Date.now() / 1000),
  selectedStatuses: InvoiceStatusFilter[] = [],
): DashboardInvoice[] {
  return invoices.filter((invoice) => {
    const matchesPreset = matchesDashboardPreset(invoice, publicKey, preset, now);
    const matchesQuery = matchesTextSearch(invoice, query);
    const matchesStatus = matchesStatusFilter(invoice, selectedStatuses, now);
    return matchesPreset && matchesQuery && matchesStatus;
  });
}

export function getDashboardPresetCounts(
  invoices: DashboardInvoice[],
  publicKey: string | null | undefined,
  now = Math.floor(Date.now() / 1000),
): Record<Exclude<DashboardPresetId, "all">, number> {
  return DASHBOARD_PRESETS.reduce(
    (counts, preset) => {
      counts[preset.id] = invoices.filter((invoice) =>
        matchesDashboardPreset(invoice, publicKey, preset.id, now),
      ).length;
      return counts;
    },
    {} as Record<Exclude<DashboardPresetId, "all">, number>,
  );
}
