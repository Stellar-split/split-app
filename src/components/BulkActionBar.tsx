import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  selectedCount: number;
  selectedInvoices: Invoice[];
  onCancel: () => void;
  onBulkCancel: () => Promise<void>;
  onBulkExport: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalCount: number;
}

/**
 * BulkActionBar — toolbar for bulk operations on selected invoices.
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
}: Props) {
  const pendingCount = selectedInvoices.filter(
    (inv) => inv.status === "Pending",
  ).length;

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 flex flex-wrap items-center justify-between gap-3 z-30">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-300">
          {selectedCount} selected
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
  );
}
