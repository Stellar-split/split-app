"use client";

import { INVOICE_STATUS_FILTERS, type InvoiceStatusFilter } from "@/lib/dashboardFilters";

interface Props {
  selected: InvoiceStatusFilter[];
  onToggle: (status: InvoiceStatusFilter) => void;
}

/**
 * Status filter chips synced to the dashboard's `?status=` URL param by the
 * caller (DashboardClient). Multiple chips can be active at once; clicking
 * an active chip deactivates just that one.
 */
export default function StatusFilterChips({ selected, onToggle }: Props) {
  return (
    <div className="flex items-center gap-2 mb-3 overflow-x-auto" aria-label="Filter by status">
      {INVOICE_STATUS_FILTERS.map((status) => {
        const isActive = selected.includes(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
            aria-pressed={isActive}
          >
            {status}
          </button>
        );
      })}
    </div>
  );
}
