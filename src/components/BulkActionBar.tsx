"use client";

import { useState } from "react";
import type { Invoice } from "@stellar-split/sdk";
import {
  archiveInvoices,
  unarchiveInvoices,
  isInvoiceArchived,
  getUndoTimeout,
} from "@/lib/archiveInvoices";
import {
  exportInvoicesBulk,
  printInvoicesBulk,
  type BulkExportFormat,
} from "@/lib/bulkInvoiceOps";

interface Props {
  selectedCount: number;
  selectedInvoices: Invoice[];
  onCancel: () => void;
  onBulkCancel: () => Promise<void>;
  /** @deprecated Use the built-in export; kept for backward-compat. */
  onBulkExport?: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalCount: number;
  onArchiveChange?: () => void;
  archivedOnly?: boolean;
}

/**
 * BulkActionBar — toolbar for bulk operations on selected invoices.
 *
 * Supports: cancel, export (CSV / JSON), print, archive, unarchive.
 *
 * Issue #810: extended with print and multi-format export.
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
  const [showExportMenu, setShowExportMenu] = useState(false);

  const pendingCount = selectedInvoices.filter(
    (inv) => inv.status === "Pending",
  ).length;

  const archivedCount = selectedInvoices.filter((inv) =>
    isInvoiceArchived(inv.id),
  ).length;

  // ── Archive ────────────────────────────────────────────────────────────────

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
      setTimeout(() => setShowUndoToast(false), getUndoTimeout());
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
      setTimeout(() => setShowUndoToast(false), getUndoTimeout());
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

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = (format: BulkExportFormat) => {
    setShowExportMenu(false);
    if (selectedInvoices.length === 0) return;
    exportInvoicesBulk(selectedInvoices, format);
  };

  // Fall back to legacy prop if provided and no built-in export needed
  const handleLegacyExport = () => {
    if (onBulkExport) {
      onBulkExport();
    } else {
      handleExport("csv");
    }
  };

  // ── Print ──────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (selectedInvoices.length === 0) return;
    printInvoicesBulk(selectedInvoices, { showRecipients: true });
  };

  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 flex flex-wrap items-center justify-between gap-3 z-30">
        {/* Left: selection info */}
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

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cancel pending invoices */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onBulkCancel}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Cancel ({pendingCount})
            </button>
          )}

          {/* Archive */}
          {!archivedOnly && archivedCount < selectedCount && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {archiveLoading
                ? "Archiving…"
                : `Archive (${selectedCount - archivedCount})`}
            </button>
          )}

          {/* Unarchive */}
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={handleUnarchive}
              disabled={archiveLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {archiveLoading
                ? "Unarchiving…"
                : `Unarchive (${archivedCount})`}
            </button>
          )}

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors"
            title="Print selected invoices"
          >
            🖨 Print
          </button>

          {/* Export with format dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors flex items-center gap-1"
              aria-haspopup="true"
              aria-expanded={showExportMenu}
            >
              Export
              <svg
                className="w-3 h-3 ml-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {showExportMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-30"
                  aria-hidden="true"
                  onClick={() => setShowExportMenu(false)}
                />
                <div
                  className="absolute right-0 bottom-full mb-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-40 overflow-hidden"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport("csv")}
                    className="w-full text-left text-xs px-3 py-2 text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport("json")}
                    className="w-full text-left text-xs px-3 py-2 text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    Export as JSON
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Done */}
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
        <div className="fixed bottom-20 right-4 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg z-40 flex items-center gap-3">
          <span className="text-sm text-gray-200">
            {undoAction.isArchive
              ? "Invoices archived"
              : "Invoices unarchived"}
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
