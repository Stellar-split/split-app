"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import TagInput from "@/components/invoice/TagInput";
import { apiFetch } from "@/lib/api";

interface BulkTagModalProps {
  /** IDs of the selected invoices */
  selectedIds: string[];
  /** All existing tags across invoices, used for autocomplete */
  existingTags?: string[];
  /** Called after the optimistic update is applied (passes the tags added) */
  onOptimisticUpdate?: (ids: string[], tags: string[]) => void;
  /** Called if the API call fails and the optimistic update should be rolled back */
  onRollback?: () => void;
  /** Called when the modal should close (success or cancel) */
  onClose: () => void;
  /** Show an error toast — provided by the parent so modals stay decoupled */
  onError?: (message: string) => void;
}

/**
 * BulkTagModal — lets users apply one or more tags to all selected invoices
 * in a single API request (Issue #518).
 *
 * Flow:
 *  1. User picks tags via TagInput (autocomplete from existingTags).
 *  2. On confirm the parent's onOptimisticUpdate is called immediately so the
 *     list updates before the network round-trip.
 *  3. PATCH /api/invoices/bulk { ids, addTags } is sent.
 *  4. On failure, onRollback is called and an error toast is shown.
 */
export default function BulkTagModal({
  selectedIds,
  existingTags = [],
  onOptimisticUpdate,
  onRollback,
  onClose,
  onError,
}: BulkTagModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLDivElement>(null);

  // Focus trap: return focus to the dialog on mount
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (tags.length === 0 || submitting) return;

    setSubmitting(true);

    // 1. Optimistic update — parent updates the list immediately
    onOptimisticUpdate?.(selectedIds, tags);
    onClose();

    try {
      const res = await apiFetch("/api/invoices/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, addTags: tags }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? "Failed to apply tags"
        );
      }
    } catch (err) {
      // 2. Roll back the optimistic update and surface the error
      onRollback?.();
      onError?.(
        err instanceof Error ? err.message : "Failed to apply tags to invoices"
      );
    } finally {
      setSubmitting(false);
    }
  }, [tags, submitting, selectedIds, onOptimisticUpdate, onRollback, onClose, onError]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="bulk-tag-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2
            id="bulk-tag-modal-title"
            className="text-base font-semibold text-white"
          >
            Add tags to {selectedIds.length} invoice
            {selectedIds.length === 1 ? "" : "s"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div ref={firstFocusRef} className="px-5 py-4" tabIndex={-1}>
          <p className="text-sm text-gray-400 mb-4">
            Tags will be added to all selected invoices. Existing tags are
            preserved.
          </p>

          <TagInput
            value={tags}
            onChange={setTags}
            suggestions={existingTags}
            label="Tags to apply"
            placeholder="Type a tag and press Enter"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={tags.length === 0 || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            data-testid="bulk-tag-confirm"
          >
            {submitting
              ? "Applying…"
              : `Apply to ${selectedIds.length} invoice${selectedIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
