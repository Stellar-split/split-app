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
  getBulkInvoiceAudit,
  printInvoicesBulk,
  recordBulkInvoiceOperation,
  type BulkInvoiceOperation,
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
  const [pendingOperation, setPendingOperation] = useState<BulkInvoiceOperation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<ReturnType<typeof getBulkInvoiceAudit>>([]);
  const [showAudit, setShowAudit] = useState(false);

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
      setPendingOperation(null);
      setOperationError(null);
    } catch (error) {
      setOperationError(`Could not archive invoices: ${String(error)}`);
      return;
    } finally {
      setArchiveLoading(false);
    }
    try {
      recordBulkInvoiceOperation({
        operation: "archive",
        invoiceIds: idsToArchive,
        timestamp: Date.now(),
      });
    } catch (error) {
      setOperationError(`Invoices were archived, but the audit entry could not be saved: ${String(error)}`);
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
      setPendingOperation(null);
      setOperationError(null);
    } catch (error) {
      setOperationError(`Could not unarchive invoices: ${String(error)}`);
      return;
    } finally {
      setArchiveLoading(false);
    }
    try {
      recordBulkInvoiceOperation({
        operation: "unarchive",
        invoiceIds: idsToUnarchive,
        timestamp: Date.now(),
      });
    } catch (error) {
      setOperationError(`Invoices were unarchived, but the audit entry could not be saved: ${String(error)}`);
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
    try {
      recordBulkInvoiceOperation({
        operation: "undo",
        invoiceIds: undoAction.ids,
        timestamp: Date.now(),
        details: undoAction.isArchive ? "Undo archive" : "Undo unarchive",
      });
      setOperationError(null);
    } catch (error) {
      setOperationError(`Undo completed, but the audit entry could not be saved: ${String(error)}`);
    }
  };

  const confirmOperation = async () => {
    if (!pendingOperation) return;
    if (pendingOperation === "archive") {
      await handleArchive();
    } else if (pendingOperation === "unarchive") {
      await handleUnarchive();
    } else {
      setArchiveLoading(true);
      try {
        await onBulkCancel();
        setPendingOperation(null);
        setOperationError(null);
        try {
          recordBulkInvoiceOperation({
            operation: "cancel",
            invoiceIds: selectedInvoices
              .filter((invoice) => invoice.status === "Pending")
              .map((invoice) => invoice.id),
            timestamp: Date.now(),
          });
        } catch (error) {
          setOperationError(`Invoices were cancelled, but the audit entry could not be saved: ${String(error)}`);
        }
      } catch (error) {
        setOperationError(`Could not cancel invoices: ${String(error)}`);
      } finally {
        setArchiveLoading(false);
      }
    }
  };

  const toggleAudit = () => {
    if (showAudit) {
      setShowAudit(false);
      return;
    }
    try {
      setAuditEntries(getBulkInvoiceAudit());
      setOperationError(null);
      setShowAudit(true);
    } catch (error) {
      setOperationError(`Could not load the local operation audit: ${String(error)}`);
    }
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
              onClick={() => {
                setPendingOperation("cancel");
                setOperationError(null);
              }}
              disabled={archiveLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              Cancel ({pendingCount})
            </button>
          )}

          {/* Archive */}
          {!archivedOnly && archivedCount < selectedCount && (
            <button
              type="button"
              onClick={() => {
                setPendingOperation("archive");
                setOperationError(null);
              }}
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
              onClick={() => {
                setPendingOperation("unarchive");
                setOperationError(null);
              }}
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
            onClick={toggleAudit}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors"
            aria-expanded={showAudit}
          >
            {showAudit ? "Hide audit" : "Audit trail"}
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

      {operationError && (
        <p role="alert" className="fixed bottom-20 left-4 z-50 max-w-lg rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200 shadow-xl">
          {operationError}
        </p>
      )}

      {showAudit && (
        <section aria-label="Bulk operation audit trail" className="fixed bottom-20 right-4 z-40 max-h-80 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold text-white">Recent bulk operations (this browser)</h2>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No recorded bulk operations.</p>
          ) : (
            <ol className="space-y-3">
              {auditEntries.map((entry, index) => (
                <li key={`${entry.timestamp}-${index}`} className="border-b border-gray-800 pb-2 text-xs">
                  <p className="font-semibold text-gray-200">
                    {entry.operation} · {entry.invoiceIds.length} invoice{entry.invoiceIds.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-gray-400">{new Date(entry.timestamp).toLocaleString()}</p>
                  <p className="break-all text-gray-500">{entry.invoiceIds.join(", ")}</p>
                  {entry.details && <p className="text-gray-400">{entry.details}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {pendingOperation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !archiveLoading) setPendingOperation(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-operation-title"
            className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
          >
            <h2 id="bulk-operation-title" className="text-lg font-semibold text-white">
              Review {pendingOperation} operation
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {pendingOperation === "cancel"
                ? `${pendingCount} pending invoice${pendingCount === 1 ? "" : "s"} will be cancelled.`
                : `${pendingOperation === "archive" ? selectedCount - archivedCount : archivedCount} invoice${(pendingOperation === "archive" ? selectedCount - archivedCount : archivedCount) === 1 ? "" : "s"} will be ${pendingOperation}d.`}
            </p>
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-gray-800 p-3">
              {selectedInvoices
                .filter((invoice) => pendingOperation !== "cancel" || invoice.status === "Pending")
                .filter((invoice) =>
                  pendingOperation === "archive"
                    ? !isInvoiceArchived(invoice.id)
                    : pendingOperation === "unarchive"
                      ? isInvoiceArchived(invoice.id)
                      : true,
                )
                .map((invoice) => (
                  <li key={invoice.id} className="flex justify-between gap-4 text-sm text-gray-200">
                    <span className="font-mono">#{invoice.id}</span>
                    <span className="text-gray-400">{invoice.status}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={archiveLoading}
                onClick={() => setPendingOperation(null)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50"
              >
                Review later
              </button>
              <button
                type="button"
                disabled={archiveLoading}
                onClick={confirmOperation}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {archiveLoading ? "Processing…" : `Confirm ${pendingOperation}`}
              </button>
            </div>
          </section>
        </div>
      )}

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
