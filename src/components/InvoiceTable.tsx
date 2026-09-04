"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import { getInvoiceDisplayStatus } from "@/lib/dashboardFilters";

// ── Column definitions ────────────────────────────────────────────────────────

export type SortColumn = "id" | "amount" | "status" | "deadline" | "funded";

type ColumnKey = "id" | "status" | "amount" | "funded" | "deadline" | "tags" | "recipients";

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  id: true, status: true, amount: true, funded: true, deadline: true, tags: true, recipients: true,
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  id: "ID", status: "Status", amount: "Amount", funded: "Funded",
  deadline: "Deadline", tags: "Tags", recipients: "Recipients",
};
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
        <span>{label}</span>
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

  const [colVisible, setColVisible] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem("invoiceTableColumns");
      if (saved) return { ...DEFAULT_COLUMNS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_COLUMNS;
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!dropdownRef.current?.contains(t) && !gearRef.current?.contains(t)) setDropdownOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [dropdownOpen]);

  const toggleCol = (col: ColumnKey) => {
    setColVisible(prev => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem("invoiceTableColumns", JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
    <div>
      {/* Gear button + column settings dropdown */}
      <div className="flex justify-end mb-2">
        <div className="relative">
          <button
            ref={gearRef}
            aria-label="Column settings"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-6a.75.75 0 0 1 .75.75v.6a3.5 3.5 0 0 1 1.77 1.02l.52-.3a.75.75 0 1 1 .75 1.3l-.52.3c.1.37.15.76.15 1.16s-.05.79-.15 1.16l.52.3a.75.75 0 1 1-.75 1.3l-.52-.3A3.5 3.5 0 0 1 8.75 11v.25a.75.75 0 0 1-1.5 0V11a3.5 3.5 0 0 1-1.77-1.02l-.52.3a.75.75 0 1 1-.75-1.3l.52-.3A3.5 3.5 0 0 1 4.58 7.42l-.52-.3a.75.75 0 1 1 .75-1.3l.52.3A3.5 3.5 0 0 1 7.25 5.1v-.35A.75.75 0 0 1 8 4z"/>
            </svg>
          </button>
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-1 z-20 min-w-[160px] rounded-lg border border-gray-700 bg-gray-900 shadow-lg py-1"
            >
              {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={colVisible[col]}
                    onChange={() => toggleCol(col)}
                    className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  {COLUMN_LABELS[col]}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table
          className="min-w-full text-sm"
          aria-label="Invoice list"
        >
          <thead className="bg-gray-100 dark:bg-gray-800/80">
            <tr>
              {colVisible.id && (
                <SortHeader column="id" label="ID" sort={sort} onSort={handleSort} className="w-28" />
              )}
              {colVisible.status && (
                <SortHeader column="status" label="Status" sort={sort} onSort={handleSort} className="w-28" />
              )}
              {colVisible.amount && (
                <SortHeader column="amount" label="Amount" sort={sort} onSort={handleSort} className="w-36" />
              )}
              {colVisible.funded && (
                <SortHeader column="funded" label="Funded" sort={sort} onSort={handleSort} className="w-36" />
              )}
              {colVisible.deadline && (
                <SortHeader column="deadline" label="Deadline" sort={sort} onSort={handleSort} className="w-36" />
              )}
              {colVisible.tags && (
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tags
                </th>
              )}
              {colVisible.recipients && (
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recipients
                </th>
              )}
              {rowAction && (
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">
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
              const displayNum = displayNumbers[inv.id] ?? inv.id;
              const tags = tagsByInvoice[inv.id] ?? [];

              return (
                <tr
                  key={inv.id}
                  className="group bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {colVisible.id && (
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoice/${inv.id}`}
                        className="font-mono text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                        aria-label={`View invoice ${displayNum}`}
                      >
                        {displayNum}
                      </Link>
                    </td>
                  )}

                  {colVisible.status && (
                    <td className="px-4 py-3">
                      <StatusChip status={displayStatus} />
                    </td>
                  )}

                  {colVisible.amount && (
                    <td className="px-4 py-3 font-mono text-gray-200">
                      {formatAmount(total)} USDC
                    </td>
                  )}

                  {colVisible.funded && (
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
                  )}

                  {colVisible.deadline && (
                    <td className="px-4 py-3">
                      {inv.deadline ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-300 text-xs">{formatDeadline(inv.deadline)}</span>
                          <span className={`text-[11px] font-medium ${dlUrgent ? "text-amber-400" : "text-gray-500"}`}>
                            {dlText}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  )}

                  {colVisible.tags && (
                    <td className="px-4 py-3">
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
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
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  )}

                  {colVisible.recipients && (
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
                          <span className="text-xs text-gray-500">+{inv.recipients.length - 2} more</span>
                        )}
                      </div>
                    </td>
                  )}

                  {rowAction && (
                    <td className="px-4 py-3 text-right">{rowAction(inv)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
