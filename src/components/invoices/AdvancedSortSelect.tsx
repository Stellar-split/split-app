"use client";

import {
  SORT_OPTIONS,
  SORT_GROUPS,
  type DashboardSortId,
} from "@/lib/dashboardFilters";

interface Props {
  value: DashboardSortId;
  onChange: (sort: DashboardSortId) => void;
  className?: string;
  id?: string;
}

/**
 * AdvancedSortSelect — a grouped <select> for dashboard sort options.
 *
 * Renders the SORT_OPTIONS (from dashboardFilters) in labelled <optgroup>
 * sections so the extended sort choices are easy to navigate.
 *
 * Issue #811: Implement advanced sort options for invoice lists.
 */
export default function AdvancedSortSelect({
  value,
  onChange,
  className = "",
  id = "filter-sort",
}: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as DashboardSortId)}
      className={[
        "min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800",
        "border border-gray-300 dark:border-gray-700",
        "px-3 py-1.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Sort invoices"
    >
      {SORT_GROUPS.map((group) => {
        const options = SORT_OPTIONS.filter((o) => o.group === group);
        if (options.length === 0) return null;
        return (
          <optgroup key={group} label={group}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        );
      })}

      {/* Ungrouped options as fallback */}
      {SORT_OPTIONS.filter((o) => !o.group).map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
