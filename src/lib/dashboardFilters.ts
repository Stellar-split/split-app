import type { Invoice } from "@stellar-split/sdk";

/** Dashboard view model for an invoice. Currently a direct alias of the SDK type. */
export type DashboardInvoice = Invoice;

export type DashboardPresetId = "all" | "active" | "funded" | "refunded" | "expired" | "draft" | "overdue";
/**
 * Dashboard sort options.
 *
 * Issue #811: extended with advanced sort options — funded percentage,
 * recipient count, deadline-farthest, and alphabetical-by-creator.
 */
export type DashboardSortId =
  | "newest"
  | "oldest"
  | "amount-desc"
  | "amount-asc"
  | "deadline"
  | "deadline-farthest"
  | "funded-pct-desc"
  | "funded-pct-asc"
  | "recipients-desc"
  | "recipients-asc"
  | "creator-asc"
  | "creator-desc";

export const SORT_OPTIONS: { id: DashboardSortId; label: string; group?: string }[] = [
  // ── Recency ──────────────────────────────────────────────────────────────
  { id: "newest",          label: "Most Recent",                group: "Date" },
  { id: "oldest",          label: "Oldest First",               group: "Date" },
  // ── Deadline ─────────────────────────────────────────────────────────────
  { id: "deadline",        label: "Deadline (soonest first)",   group: "Deadline" },
  { id: "deadline-farthest", label: "Deadline (farthest first)", group: "Deadline" },
  // ── Amount ───────────────────────────────────────────────────────────────
  { id: "amount-desc",     label: "Amount (high → low)",        group: "Amount" },
  { id: "amount-asc",      label: "Amount (low → high)",        group: "Amount" },
  // ── Funding progress ─────────────────────────────────────────────────────
  { id: "funded-pct-desc", label: "Funded % (most funded)",     group: "Funding" },
  { id: "funded-pct-asc",  label: "Funded % (least funded)",    group: "Funding" },
  // ── Recipients ───────────────────────────────────────────────────────────
  { id: "recipients-desc", label: "Recipients (most)",          group: "Recipients" },
  { id: "recipients-asc",  label: "Recipients (fewest)",        group: "Recipients" },
  // ── Creator ──────────────────────────────────────────────────────────────
  { id: "creator-asc",     label: "Creator (A → Z)",            group: "Creator" },
  { id: "creator-desc",    label: "Creator (Z → A)",            group: "Creator" },
];

/** Unique sort groups in declaration order, for grouped UI rendering. */
export const SORT_GROUPS: string[] = Array.from(
  new Set(SORT_OPTIONS.map((o) => o.group ?? "").filter(Boolean)),
);

/** Returns funded percentage in [0, 1] for a given invoice. */
function fundedPercent(inv: Invoice): number {
  const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
  if (total === 0n) return 0;
  // Convert bigint to number for percentage comparison (precision sufficient for sorting)
  return Number((inv.funded * 10_000n) / total) / 10_000;
}

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
      // Put invoices with no deadline (0) at the end
      return list.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline - b.deadline;
      });

    case "deadline-farthest":
      return list.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return b.deadline - a.deadline;
      });

    case "funded-pct-desc":
      return list.sort((a, b) => fundedPercent(b) - fundedPercent(a));

    case "funded-pct-asc":
      return list.sort((a, b) => fundedPercent(a) - fundedPercent(b));

    case "recipients-desc":
      return list.sort((a, b) => b.recipients.length - a.recipients.length);

    case "recipients-asc":
      return list.sort((a, b) => a.recipients.length - b.recipients.length);

    case "creator-asc":
      return list.sort((a, b) => a.creator.localeCompare(b.creator));

    case "creator-desc":
      return list.sort((a, b) => b.creator.localeCompare(a.creator));

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
  { id: "overdue",  label: "Overdue",  emptyState: "No overdue installments right now." },
];

export function matchesDashboardPreset(
  invoice: Invoice,
  preset: DashboardPresetId,
  now = Math.floor(Date.now() / 1000),
  splitMeta?: { installments?: { dueDate: number; status: string }[] } | null,
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
    case "overdue":
      if (invoice.status !== "Pending") return false;
      const installments = splitMeta?.installments ?? [];
      return installments.some(
        (m) => m.status !== "paid" && m.dueDate < now
      );
    default:
      return false;
  }
}

export function matchesTextSearch(invoice: Invoice, query: string): boolean {
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
  invoice: Invoice,
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
  invoice: Invoice,
  selectedStatuses: InvoiceStatusFilter[],
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (selectedStatuses.length === 0) return true;
  return selectedStatuses.includes(getInvoiceDisplayStatus(invoice, now) as InvoiceStatusFilter);
}

export function filterDashboardInvoices(
  invoices: Invoice[],
  preset: DashboardPresetId,
  now = Math.floor(Date.now() / 1000),
  splitMetaMap?: Record<string, { installments?: { dueDate: number; status: string }[] }>,
  selectedStatuses: InvoiceStatusFilter[] = [],
  query = "",
): Invoice[] {
  return invoices.filter(
    (invoice) =>
      matchesDashboardPreset(invoice, preset, now, splitMetaMap?.[invoice.id]) &&
      matchesStatusFilter(invoice, selectedStatuses, now) &&
      matchesTextSearch(invoice, query),
  );
}

export function getDashboardPresetCounts(
  invoices: Invoice[],
  now = Math.floor(Date.now() / 1000),
  splitMetaMap?: Record<string, { installments?: { dueDate: number; status: string }[] }>,
): Record<Exclude<DashboardPresetId, "all">, number> {
  return DASHBOARD_PRESETS.reduce(
    (counts, preset) => {
      counts[preset.id] = invoices.filter((invoice) =>
        matchesDashboardPreset(invoice, preset.id, now, splitMetaMap?.[invoice.id]),
      ).length;
      return counts;
    },
    {} as Record<Exclude<DashboardPresetId, "all">, number>,
  );
}
