"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import { getInvoiceDisplayStatus } from "@/lib/dashboardFilters";

// ── Column definitions ────────────────────────────────────────────────────────

export type SortColumn = "id" | "amount" | "status" | "deadline" | "funded";
export type SortDir = "asc" | "desc";

export interface InvoiceTableSortState {
  column: SortColumn;
  dir: SortDir;
}

const DEFAULT_SORT: InvoiceTableSortState = { column: "id", dir: "desc" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalAmount(inv: Invoice): bigint {
  return inv.recipients.reduce((s, r) => s + r.amount, 0n);
}

function formatDeadline(deadline: number): string {
  if (!deadline) return "—";
  const d = new Date(deadline * 1000);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function deadlineRelative(deadline: number): { text: string; urgent: boolean } {
  if (!deadline) return { text: "—", urgent: false };
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  const days = Math.round(diff / 86400);
  if (diff < 0) return { text: `${Math.abs(days)}d ago`, urgent: true };
  if (days === 0) return { text: "Today", urgent: true };
  if (days === 1) return { text: "Tomorrow", urgent: true };
  if (days <= 7) return { text: `in ${days}d`, urgent: true };
  return { text: `in ${days}d`, urgent: false };
}

function sortInvoices(
  invoices: Invoice[],
  { column, dir }: InvoiceTableSortState,
): Invoice[] {
  const list = [...invoices];
  const mul = dir === "asc" ? 1 : -1;
  switch (column) {
    case "id":
      return list.sort((a, b) => mul * (Number(a.id) - Number(b.id)));
    case "amount":
      return list.sort((a, b) => {
        const ta = totalAmount(a);
        const tb = totalAmount(b);
        return mul * (ta > tb ? 1 : ta < tb ? -1 : 0);
      });
    case "funded":
      return list.sort((a, b) => {
        return mul * (a.funded > b.funded ? 1 : a.funded < b.funded ? -1 : 0);
      });
    case "deadline":
      return list.sort((a, b) => mul * (a.deadline - b.deadline));
    case "status": {
      const now = Math.floor(Date.now() / 1000);
      return list.sort(
        (a, b) =>
          mul *
          getInvoiceDisplayStatus(a, now).localeCompare(
            getInvoiceDisplayStatus(b, now),
          ),
      );
    }
    default:
      return list;
  }
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Pending:  "bg-yellow-500/20 text-yellow-400",
  Funded:   "bg-cyan-500/20 text-cyan-400",
  Partial:  "bg-blue-500/20 text-blue-400",
  Released: "bg-green-500/20 text-green-400",
  Expired:  "bg-orange-500/20 text-orange-400",
  Refunded: "bg-gray-500/20 text-gray-400",
};

function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-500/20 text-gray-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

// ── Sort header button ────────────────────────────────────────────────────────

interface SortHeaderProps {
  column: SortColumn;
  label: string;
  sort: InvoiceTableSortState;
  onSort: (col: SortColumn) => void;
  className?: string;
}

function SortHeader({ column, label, sort, onSort, className = "" }: SortHeaderProps) {
  const isActive = sort.column === column;
  const icon =
    isActive ? (sort.dir === "asc" ? "↑" : "↓") : "↕";

  return (
    <th scope="col" className={`text-left px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded",
          isActive
            ? "text-indigo-400"
            : "text-gray-500 hover:text-gray-200",
        ].join(" ")}
        aria-sort={
          isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {icon}
        </span>
      </button>
    </th>
  );
}

// ── InvoiceTable ──────────────────────────────────────────────────────────────

interface InvoiceTableProps {
  invoices: Invoice[];
  /** Optional map of invoice id → display number */
  displayNumbers?: Record<string, string>;
  /** Optional map of invoice id → tag list */
  tagsByInvoice?: Record<string, string[]>;
  /** External sort state (controlled) — if omitted, sort is managed internally */
  sort?: InvoiceTableSortState;
  onSort?: (sort: InvoiceTableSortState) => void;
  /** Content to render in each row's action column */
  rowAction?: (inv: Invoice) => React.ReactNode;
}

/**
 * InvoiceTable
 *
 * A multi-column sortable table view for the invoice list.
 * Clicking a column header cycles through ascending → descending → (reset).
 * Supports both controlled (sort + onSort) and uncontrolled (internal state)
 * sorting so it can be embedded in DashboardClient without extra plumbing.
 */
export default function InvoiceTable({
  invoices,
  displayNumbers = {},
  tagsByInvoice = {},
  sort: externalSort,
  onSort: externalOnSort,
  rowAction,
}: InvoiceTableProps) {
  const [internalSort, setInternalSort] =
    useState<InvoiceTableSortState>(DEFAULT_SORT);

  const sort = externalSort ?? internalSort;

  const handleSort = useCallback(
    (col: SortColumn) => {
      const next: InvoiceTableSortState =
        sort.column === col
          ? { column: col, dir: sort.dir === "asc" ? "desc" : "asc" }
          : { column: col, dir: "asc" };
      if (externalOnSort) {
        externalOnSort(next);
      } else {
        setInternalSort(next);
      }
    },
    [sort, externalOnSort],
  );

  const sorted = useMemo(() => sortInvoices(invoices, sort), [invoices, sort]);

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-6 text-center">
        <p className="text-gray-400">No invoices match the current filters.</p>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table
        className="min-w-full text-sm"
        aria-label="Invoice list"
      >
        <thead className="bg-gray-100 dark:bg-gray-800/80">
          <tr>
            <SortHeader
              column="id"
              label="Invoice"
              sort={sort}
              onSort={handleSort}
              className="w-28"
            />
            <SortHeader
              column="status"
              label="Status"
              sort={sort}
              onSort={handleSort}
              className="w-28"
            />
            <SortHeader
              column="amount"
              label="Amount"
              sort={sort}
              onSort={handleSort}
              className="w-36"
            />
            <SortHeader
              column="funded"
              label="Funded"
              sort={sort}
              onSort={handleSort}
              className="w-36"
            />
            <SortHeader
              column="deadline"
              label="Deadline"
              sort={sort}
              onSort={handleSort}
              className="w-36"
            />
            {/* Recipients */}
            <th
              scope="col"
              className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Recipients
            </th>
            {rowAction && (
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right"
              >
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {sorted.map((inv) => {
            const total = totalAmount(inv);
            const displayStatus = getInvoiceDisplayStatus(inv, now);
            const { text: dlText, urgent: dlUrgent } = deadlineRelative(inv.deadline);
            const displayNum = displayNumbers[inv.id] ?? `#${inv.id}`;
            const tags = tagsByInvoice[inv.id] ?? [];

            return (
              <tr
                key={inv.id}
                className="group bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* ID */}
                <td className="px-4 py-3">
                  <Link
                    href={`/invoice/${inv.id}`}
                    className="font-mono text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    aria-label={`View invoice ${displayNum}`}
                  >
                    {displayNum}
                  </Link>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="inline-block rounded-full bg-indigo-900/50 border border-indigo-700/40 px-1.5 py-0 text-[10px] text-indigo-300"
                        >
                          {t}
                        </span>
                      ))}
                      {tags.length > 2 && (
                        <span className="text-[10px] text-gray-500">+{tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusChip status={displayStatus} />
                </td>

                {/* Amount */}
                <td className="px-4 py-3 font-mono text-gray-200">
                  {formatAmount(total)} USDC
                </td>

                {/* Funded */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-gray-200">
                      {formatAmount(inv.funded)} USDC
                    </span>
                    {total > 0n && (() => {
                      const pct = Math.min(100, Number((inv.funded * 100n) / total));
                      return (
                        <div
                          className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden"
                          role="progressbar"
                          aria-label="Funding progress"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${
                              inv.funded >= total
                                ? "bg-green-400"
                                : inv.funded > 0n
                                ? "bg-indigo-400"
                                : "bg-gray-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </td>

                {/* Deadline */}
                <td className="px-4 py-3">
                  {inv.deadline ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-300 text-xs">
                        {formatDeadline(inv.deadline)}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          dlUrgent ? "text-amber-400" : "text-gray-500"
                        }`}
                      >
                        {dlText}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>

                {/* Recipients */}
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    {inv.recipients.slice(0, 2).map((r) => (
                      <span
                        key={r.address}
                        className="font-mono text-[11px] text-gray-400 truncate"
                        title={r.address}
                      >
                        {r.address.slice(0, 6)}…{r.address.slice(-4)}
                      </span>
                    ))}
                    {inv.recipients.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{inv.recipients.length - 2} more
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                {rowAction && (
                  <td className="px-4 py-3 text-right">
                    {rowAction(inv)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
