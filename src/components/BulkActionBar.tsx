import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";
import {
  archiveInvoices,
  unarchiveInvoices,
  isInvoiceArchived,
  getUndoTimeout,
} from "@/lib/archiveInvoices";

interface Props {
  selectedCount: number;
  selectedInvoices: Invoice[];
  onCancel: () => void;
  onBulkCancel: () => Promise<void>;
  onBulkExport: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalCount: number;
  onArchiveChange?: () => void;
  archivedOnly?: boolean;
}

/**
 * BulkActionBar — toolbar for bulk operations on selected invoices.
 * Supports: cancel, export, archive, unarchive operations.
 */
export default function BulkActionBar({
  selectedCount,
  selectedInvoices,
  onCancel,
  onBulkCancel,
  onBulkExport,
  onSelectAll,
  onDeselectAll,
  totalCount,
  onArchiveChange,
  archivedOnly = false,
}: Props) {
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [undoAction, setUndoAction] = useState<{
    ids: string[];
    isArchive: boolean;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  const pendingCount = selectedInvoices.filter(
    (inv) => inv.status === "Pending",
  ).length;

  const archivedCount = selectedInvoices.filter((inv) =>
    isInvoiceArchived(inv.id),
  ).length;

  const handleArchive = async () => {
    const idsToArchive = selectedInvoices
      .filter((inv) => !isInvoiceArchived(inv.id))
      .map((inv) => inv.id);

    if (idsToArchive.length === 0) return;

    setArchiveLoading(true);
    try {
      archiveInvoices(idsToArchive);
      setUndoAction({ ids: idsToArchive, isArchive: true });
      setShowUndoToast(true);

      setTimeout(() => {
        setShowUndoToast(false);
      }, getUndoTimeout());

      onArchiveChange?.();
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleUnarchive = async () => {
    const idsToUnarchive = selectedInvoices
      .filter((inv) => isInvoiceArchived(inv.id))
      .map((inv) => inv.id);

    if (idsToUnarchive.length === 0) return;

    setArchiveLoading(true);
    try {
      unarchiveInvoices(idsToUnarchive);
      setUndoAction({ ids: idsToUnarchive, isArchive: false });
      setShowUndoToast(true);

      setTimeout(() => {
        setShowUndoToast(false);
      }, getUndoTimeout());

      onArchiveChange?.();
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleUndo = () => {
    if (!undoAction) return;

    if (undoAction.isArchive) {
      unarchiveInvoices(undoAction.ids);
    } else {
      archiveInvoices(undoAction.ids);
    }

    setShowUndoToast(false);
    onArchiveChange?.();
  };

  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 flex flex-wrap items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-300">
            {selectedCount} selected
            {archivedCount > 0 && (
              <span className="text-xs text-gray-500 ml-1">
                ({archivedCount} archived)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            {selectedCount === totalCount ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onBulkCancel}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Cancel ({pendingCount})
            </button>
          )}

          {!archivedOnly && archivedCount < selectedCount && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {archiveLoading ? "Archiving..." : `Archive (${selectedCount - archivedCount})`}
            </button>
          )}

          {archivedCount > 0 && (
            <button
              type="button"
              onClick={handleUnarchive}
              disabled={archiveLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {archiveLoading ? "Unarchiving..." : `Unarchive (${archivedCount})`}
            </button>
          )}

          <button
            type="button"
            onClick={onBulkExport}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Undo toast */}
      {showUndoToast && undoAction && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg z-40 flex items-center gap-3">
          <span className="text-sm text-gray-200">
            {undoAction.isArchive ? "Invoices archived" : "Invoices unarchived"}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
