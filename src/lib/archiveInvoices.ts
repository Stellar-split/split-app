/**
 * Archive/Unarchive Invoices Utility
 *
 * Provides functionality for bulk archive and unarchive operations.
 * Archived invoices are stored in localStorage with a timestamp for undo capability.
 */

const ARCHIVE_STORAGE_KEY = "archived_invoices";
const UNDO_TIMEOUT_MS = 10_000; // 10 seconds for undo toast

export interface ArchivedInvoice {
  id: string;
  archivedAt: number;
  wasArchived: boolean; // true = archived, false = unarchived
}

/**
 * Archive invoices locally
 * @param invoiceIds - IDs of invoices to archive
 * @returns Archived invoice records
 */
export function archiveInvoices(invoiceIds: string[]): ArchivedInvoice[] {
  const archived = getArchivedInvoices();
  const timestamp = Date.now();

  const newArchives = invoiceIds.map((id) => ({
    id,
    archivedAt: timestamp,
    wasArchived: true,
  }));

  const updated = {
    ...archived,
    ...Object.fromEntries(newArchives.map((a) => [a.id, a])),
  };

  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
  return newArchives;
}

/**
 * Unarchive invoices locally
 * @param invoiceIds - IDs of invoices to unarchive
 * @returns Unarchived invoice records
 */
export function unarchiveInvoices(invoiceIds: string[]): ArchivedInvoice[] {
  const archived = getArchivedInvoices();
  const timestamp = Date.now();

  const unarchived = invoiceIds.map((id) => ({
    id,
    archivedAt: timestamp,
    wasArchived: false,
  }));

  // Remove unarchived items
  unarchived.forEach((u) => {
    delete archived[u.id];
  });

  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archived));
  return unarchived;
}

/**
 * Get all archived invoices
 */
export function getArchivedInvoices(): Record<string, ArchivedInvoice> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Failed to parse archived invoices:", e);
    return {};
  }
}

/**
 * Check if an invoice is archived
 */
export function isInvoiceArchived(invoiceId: string): boolean {
  const archived = getArchivedInvoices();
  return invoiceId in archived;
}

/**
 * Clear archive history (call after successful server-side persistence)
 */
export function clearArchiveHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  }
}

/**
 * Get undo timeout duration
 */
export function getUndoTimeout(): number {
  return UNDO_TIMEOUT_MS;
}

/**
 * Filter invoices to show only archived or non-archived based on filter
 */
export function filterByArchiveStatus(
  invoices: Array<{ id: string }>,
  archivedOnly: boolean,
): Array<{ id: string }> {
  return invoices.filter((inv) => {
    const isArchived = isInvoiceArchived(inv.id);
    return archivedOnly ? isArchived : !isArchived;
  });
}
