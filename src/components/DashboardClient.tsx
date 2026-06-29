"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceSearch from "@/components/InvoiceSearch";
import InvoiceCard from "@/components/InvoiceCard";
import { InvoiceListSkeleton, SkeletonCard } from "@/components/Skeleton";
import BatchPayModal from "@/components/BatchPayModal";
import { setBulkReminders, type BulkReminderResult } from "@/lib/reminders";
import { getOrAssignDisplayNumber } from "@/lib/invoiceNumbering";
import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import {
  DASHBOARD_PRESETS,
  SORT_OPTIONS,
  filterDashboardInvoices,
  getDashboardPresetCounts,
  sortInvoices,
  filterByDateRange,
  type DashboardPresetId,
  type DashboardSortId,
} from "@/lib/dashboardFilters";

// ── URL helpers ──────────────────────────────────────────────────────────────

function readParams(sp: URLSearchParams) {
  const statuses = (sp.get("status") ?? "").split(",").filter(Boolean) as DashboardPresetId[];
  const sort = (sp.get("sort") ?? "newest") as DashboardSortId;
  const dateFrom = sp.get("from") ?? "";
  const dateTo = sp.get("to") ?? "";
  return { statuses, sort, dateFrom, dateTo };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-derived filter state
  const { statuses, sort, dateFrom, dateTo } = useMemo(
    () => readParams(searchParams),
    [searchParams],
  );

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [numericResult, setNumericResult] = useState<Invoice | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [reminderSelect, setReminderSelect] = useState(false);
  const [reminderSelected, setReminderSelected] = useState<Set<string>>(new Set());
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState("");
  const [bulkReminderResults, setBulkReminderResults] = useState<BulkReminderResult[] | null>(null);
  // Mobile filter drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── URL mutation helpers ────────────────────────────────────────────────────

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const toggleStatus = (preset: DashboardPresetId) => {
    const next = statuses.includes(preset)
      ? statuses.filter((s) => s !== preset)
      : [...statuses, preset];
    pushParams({ status: next.join(",") });
  };

  const clearFilters = () => {
    router.replace("?", { scroll: false });
    setSearchValue("");
  };

  const isFiltered =
    statuses.length > 0 || dateFrom || dateTo || sort !== "newest";

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view your dashboard."));
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    const fetchInvoices = async () => {
      setLoading(true);
      const results: Invoice[] = [];
      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const mine =
            inv.creator === publicKey ||
            inv.recipients.some((r) => r.address === publicKey);
          if (mine) {
            results.push(inv);
            setInvoices([...results]);
          }
        } catch {
          break;
        }
      }
      setLoading(false);
    };
    fetchInvoices().catch((e) => { setError(String(e)); setLoading(false); });
  }, [publicKey]);

  // Numeric search debounce
  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      setNumericResult(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const inv = await splitClient.getInvoice(trimmed);
        if (!cancelled) setNumericResult(inv);
      } catch {
        if (!cancelled) setNumericResult(null);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [searchValue]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const presetCounts = useMemo(() => getDashboardPresetCounts(invoices), [invoices]);

  const visibleInvoices = useMemo(() => {
    // 1. status filter (multi-select chips); if none selected show all
    let result =
      statuses.length === 0
        ? invoices
        : invoices.filter((inv) =>
            statuses.some((s) =>
              filterDashboardInvoices([inv], s).length > 0,
            ),
          );
    // 2. date range
    result = filterByDateRange(result, dateFrom, dateTo);
    // 3. sort
    result = sortInvoices(result, sort);
    return result;
  }, [invoices, statuses, dateFrom, dateTo, sort]);

  const { totalActive, totalValueLocked, totalReleased } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    let tvl = 0n, released = 0n, active = 0;
    for (const inv of invoices) {
      const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
      if (inv.status === "Pending") {
        if (inv.deadline > now) active++;
        tvl += total;
      } else if (inv.status === "Released") {
        released += total;
      }
    }
    return { totalActive: active, totalValueLocked: tvl, totalReleased: released };
  }, [invoices]);

  const pendingInvoices = invoices.filter((inv) => inv.status === "Pending");
  const selectedInvoices = invoices.filter((inv) => selected.has(inv.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitMultiSelect = () => { setMultiSelect(false); setSelected(new Set()); };

  const toggleReminderSelect = (id: string) => {
    setReminderSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitReminderSelect = () => {
    setReminderSelect(false);
    setReminderSelected(new Set());
    setShowReminderPicker(false);
    setReminderDateTime("");
    setBulkReminderResults(null);
  };

  const handleScheduleBulkReminders = () => {
    if (!reminderDateTime || reminderSelected.size === 0) return;
    const results = setBulkReminders(
      Array.from(reminderSelected),
      new Date(reminderDateTime).toISOString(),
    );
    setBulkReminderResults(results);
    setReminderSelected(new Set());
    setShowReminderPicker(false);
    setReminderDateTime("");
  };

  // ── Error state ─────────────────────────────────────────────────────────────

  if (error) {
    return <div className="text-center py-20"><p className="text-red-400">{error}</p></div>;
  }

  // ── Filter / sort controls (shared between sticky bar and drawer) ──────────

  const filterControls = (
    <div className="flex flex-col gap-4">
      {/* Status chips */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_PRESETS.map((preset) => {
            const active = statuses.includes(preset.id);
            const count = presetCounts[preset.id] ?? 0;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => toggleStatus(preset.id)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {preset.label}
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500" htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={dateFrom}
            onChange={(e) => pushParams({ from: e.target.value })}
            className="min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500" htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={dateTo}
            onChange={(e) => pushParams({ to: e.target.value })}
            className="min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide" htmlFor="filter-sort">Sort by</label>
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => pushParams({ sort: e.target.value })}
          className="min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {isFiltered && (
        <button
          type="button"
          onClick={clearFilters}
          className="self-start rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          {!multiSelect && !reminderSelect && pendingInvoices.length > 0 && (
            <button
              onClick={() => setMultiSelect(true)}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
            >
              Pay Multiple
            </button>
          )}
          {!multiSelect && !reminderSelect && invoices.length > 0 && (
            <button
              onClick={() => { setBulkReminderResults(null); setReminderSelect(true); }}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
            >
              Schedule Reminders
            </button>
          )}
          {multiSelect && (
            <>
              <button onClick={exitMultiSelect} className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors">Cancel</button>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={selected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Pay Selected ({selected.size})
              </button>
            </>
          )}
          {reminderSelect && (
            <>
              <button onClick={exitReminderSelect} className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors">Cancel</button>
              <button
                onClick={() => setShowReminderPicker(true)}
                disabled={reminderSelected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Set Reminder ({reminderSelected.size})
              </button>
            </>
          )}
          <Link href="/invoice/new" className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors">
            + New Invoice
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Active</p>
            <p className="text-2xl font-bold text-gray-100">{totalActive}</p>
          </div>
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Value Locked</p>
            <p className="text-2xl font-bold text-gray-100">{formatAmount(totalValueLocked)} USDC</p>
          </div>
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Released</p>
            <p className="text-2xl font-bold text-green-400">{formatAmount(totalReleased)} USDC</p>
          </div>
        </div>
      )}

      {/* Sticky desktop filter bar */}
      <div className="hidden md:block sticky top-14 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6">
        {filterControls}
      </div>

      {/* Mobile: collapsible filter drawer toggle */}
      <div className="md:hidden mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex items-center gap-2 min-h-10 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-sm font-semibold transition-colors"
          aria-expanded={drawerOpen}
          aria-controls="filter-drawer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Filters {isFiltered && <span className="ml-1 rounded-full bg-indigo-600 text-white text-xs px-1.5 py-0.5">on</span>}
        </button>
        {isFiltered && (
          <button type="button" onClick={clearFilters} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            Clear filters
          </button>
        )}
      </div>
      {drawerOpen && (
        <div id="filter-drawer" className="md:hidden mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          {filterControls}
        </div>
      )}

      {/* Search */}
      <InvoiceSearch
        invoices={invoices}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        numericResult={numericResult}
        loading={searchLoading}
        onNumericResult={setNumericResult}
      />

      {/* Invoice count */}
      {!loading && invoices.length > 0 && (
        <p className="text-sm text-gray-500 mb-4" aria-live="polite">
          Showing {visibleInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Multi-select messages */}
      {multiSelect && <p className="text-sm text-gray-400 mb-4" role="status">Select pending invoices to pay in a single transaction.</p>}
      {reminderSelect && <p className="text-sm text-gray-400 mb-4" role="status">Select invoices to schedule a reminder for.</p>}

      {/* Bulk reminder results */}
      {bulkReminderResults && (
        <div className="mb-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reminder scheduling results:</p>
          <ul className="flex flex-col gap-1">
            {bulkReminderResults.map((r) => (
              <li key={r.invoiceId} className="text-xs flex items-center gap-2">
                <span className={r.success ? "text-green-400" : "text-red-400"}>{r.success ? "✓" : "✗"}</span>
                <span className="text-gray-700 dark:text-gray-300">Invoice #{r.invoiceId}</span>
                {!r.success && r.error && <span className="text-red-400">{r.error}</span>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setBulkReminderResults(null)} className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors">Dismiss</button>
        </div>
      )}

      {/* Invoice grid */}
      {loading && invoices.length === 0 ? (
        <InvoiceListSkeleton />
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-300 mb-2">No invoices yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">Create your first invoice to start receiving payments on-chain.</p>
          <Link href="/invoice/new" className="inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors">
            + Create your first invoice
          </Link>
        </div>
      ) : visibleInvoices.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-6 text-center">
          <p className="text-gray-400">No invoices match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleInvoices.map((inv) => {
            const isSelectable = multiSelect && inv.status === "Pending";
            const isSelected = selected.has(inv.id);
            const isReminderSelectable = reminderSelect;
            const isReminderSelected = reminderSelected.has(inv.id);

            const card = (
              <InvoiceCard invoice={inv} displayNumber={getOrAssignDisplayNumber(inv.id)} />
            );

            if (isSelectable) {
              return (
                <button key={inv.id} type="button" onClick={() => toggleSelect(inv.id)} aria-pressed={isSelected}
                  className={`w-full text-left rounded-xl ring-2 transition-all ${isSelected ? "ring-indigo-500" : "ring-transparent hover:ring-gray-600"}`}>
                  <div className="relative">
                    {isSelected && <span aria-hidden="true" className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold z-10">✓</span>}
                    {card}
                  </div>
                </button>
              );
            }
            if (isReminderSelectable) {
              return (
                <button key={inv.id} type="button" onClick={() => toggleReminderSelect(inv.id)} aria-pressed={isReminderSelected}
                  className={`w-full text-left rounded-xl ring-2 transition-all ${isReminderSelected ? "ring-indigo-500" : "ring-transparent hover:ring-gray-600"}`}>
                  <div className="relative">
                    {isReminderSelected && <span aria-hidden="true" className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold z-10">✓</span>}
                    {card}
                  </div>
                </button>
              );
            }
            return (
              <Link key={inv.id} href={`/invoice/${inv.id}`} className="block">{card}</Link>
            );
          })}
          {loading && [...Array(3)].map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
        </div>
      )}

      {/* Batch Pay Modal */}
      {showBatchModal && publicKey && selectedInvoices.length > 0 && (
        <BatchPayModal
          invoices={selectedInvoices}
          publicKey={publicKey}
          onClose={() => { setShowBatchModal(false); exitMultiSelect(); }}
        />
      )}

      {/* Reminder Picker Modal */}
      {showReminderPicker && (
        <div role="dialog" aria-modal="true" aria-label="Schedule bulk reminders" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Schedule Reminders</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Applies to {reminderSelected.size} selected invoice{reminderSelected.size !== 1 ? "s" : ""}.</p>
            <label htmlFor="bulk-reminder-dt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder date &amp; time</label>
            <input
              id="bulk-reminder-dt"
              type="datetime-local"
              value={reminderDateTime}
              onChange={(e) => setReminderDateTime(e.target.value)}
              className="w-full min-h-11 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowReminderPicker(false); setReminderDateTime(""); }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleScheduleBulkReminders} disabled={!reminderDateTime}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50">
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
