/**
 * Status/search filtering for the RSC invoice list page.
 *
 * Deliberately self-contained rather than importing from
 * `@/lib/dashboardFilters` — several of its status/search helpers reference
 * a `DashboardInvoice` type that isn't defined anywhere in that module, so
 * importing them would carry a pre-existing type error into this page.
 */
import type { Invoice } from "@stellar-split/sdk";
import { INVOICE_STATUS_FILTERS, type InvoiceStatusFilter } from "@/lib/dashboardFilters";

export { INVOICE_STATUS_FILTERS };
export type { InvoiceStatusFilter };

export function getDisplayStatus(
  invoice: Invoice,
  now = Math.floor(Date.now() / 1000)
): InvoiceStatusFilter | "Refunded" {
  if (invoice.status === "Released") return "Released";
  if (invoice.status === "Refunded") return "Refunded";

  const total = invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);

  if (invoice.deadline > 0 && invoice.deadline < now) return "Expired";
  if (total > 0n && invoice.funded >= total) return "Funded";
  if (invoice.funded > 0n) return "Partial";
  return "Pending";
}

export function matchesStatuses(
  invoice: Invoice,
  selected: InvoiceStatusFilter[],
  now = Math.floor(Date.now() / 1000)
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(getDisplayStatus(invoice, now) as InvoiceStatusFilter);
}

export function matchesQuery(invoice: Invoice, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const memo = (invoice as { memo?: string }).memo;
  const haystack = `${invoice.title ?? ""} ${memo ?? ""}`.toLowerCase();
  return haystack.includes(trimmed.toLowerCase());
}
