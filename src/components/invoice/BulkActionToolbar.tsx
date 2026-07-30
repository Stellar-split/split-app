"use client";

import { useState } from "react";
import { Trash2, Archive, Tag, X } from "lucide-react";
import BulkTagModal from "@/components/invoice/BulkTagModal";

interface Props {
  selectedCount: number;
  selectedIds: Set<string>;
  totalVisible: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  /** @deprecated Pass onTagApplied instead. onTag is kept for backwards compat. */
  onTag?: () => void;
  /**
   * Called after the optimistic tag update is applied.
   * Receives the affected invoice ids and the tags that were added.
   * The parent should update its local invoice list (e.g. via mutate/immer).
   */
  onTagApplied?: (ids: string[], addedTags: string[]) => void;
  /** Called if the tag API call fails and the optimistic update must be rolled back. */
  onTagRollback?: () => void;
  /** Show an error toast — e.g. (msg) => addToast(msg, 'error') */
  onError?: (message: string) => void;
  /** All existing tag names for autocomplete inside the modal */
  existingTags?: string[];
}

export default function BulkActionToolbar({
  selectedCount,
  selectedIds,
  totalVisible,
  onSelectAll,
  onDeselectAll,
  onArchive,
  onDelete,
  onTag,
  onTagApplied,
  onTagRollback,
  onError,
  existingTags = [],
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const handleArchive = async () => {
    setProcessing(true);
    try {
      await onArchive();
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selectedCount} invoice(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    setProcessing(true);
    try {
      await onDelete();
    } finally {
      setProcessing(false);
    }
  };

  const handleTagClick = () => {
    // Open the BulkTagModal; also call legacy onTag if provided.
    onTag?.();
    setTagModalOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="text-sm font-medium text-gray-300">
              {selectedCount} of {totalVisible} selected
            </div>

            {selectedCount > 0 && totalVisible > selectedCount && (
              <button
                onClick={onSelectAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline"
              >
                Select all {totalVisible}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTagClick}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 text-gray-300"
              aria-label="Tag selected invoices"
              data-testid="bulk-tag-button"
            >
              <Tag size={16} />
              <span className="hidden sm:inline">Tag</span>
            </button>

            <button
              onClick={handleArchive}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50 text-gray-300"
              aria-label="Archive selected invoices"
            >
              <Archive size={16} />
              <span className="hidden sm:inline">Archive</span>
            </button>

            <button
              onClick={handleDelete}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-sm font-medium transition-colors disabled:opacity-50 text-red-400"
              aria-label="Delete selected invoices"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Delete</span>
            </button>

            <button
              onClick={onDeselectAll}
              disabled={processing}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
              aria-label="Close toolbar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {tagModalOpen && (
        <BulkTagModal
          selectedIds={Array.from(selectedIds)}
          existingTags={existingTags}
          onOptimisticUpdate={(ids, tags) => onTagApplied?.(ids, tags)}
          onRollback={() => onTagRollback?.()}
          onClose={() => setTagModalOpen(false)}
          onError={(msg) => onError?.(msg)}
        />
      )}
    </>
  );
}
