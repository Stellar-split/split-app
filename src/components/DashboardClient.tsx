"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceSearch from "@/components/InvoiceSearch";
import InvoiceCard from "@/components/InvoiceCard";
import { InvoiceListSkeleton } from "@/components/Skeleton";
import BatchPayModal from "@/components/BatchPayModal";
import { setBulkReminders, type BulkReminderResult } from "@/lib/reminders";
import { getOrAssignDisplayNumber } from "@/lib/invoiceNumbering";
import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import {
  DASHBOARD_PRESETS,
  filterDashboardInvoices,
  getDashboardPresetCounts,
  type DashboardPresetId,
} from "@/lib/dashboardFilters";

export default function DashboardClient() {
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
  const [activePreset, setActivePreset] = useState<DashboardPresetId>("all");

  // Get wallet public key
  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view your dashboard."),
      );
  }, []);

  // Fetch invoices progressively
  useEffect(() => {
    if (!publicKey) return;

    const fetchInvoices = async () => {
      setLoading(true);
      const results: Invoice[] = [];

      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const isCreator = inv.creator === publicKey;
          const isRecipient = inv.recipients.some(
            (r) => r.address === publicKey,
          );
          if (isCreator || isRecipient) {
            results.push(inv);
            setInvoices([...results]);
          }
        } catch {
          break;
        }
      }
      setLoading(false);
    };

    fetchInvoices().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, [publicKey]);

  // Numeric search with debounce
  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      setNumericResult(null);
      setSearchLoading(false);
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
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

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchValue]);

  const handlePresetToggle = (preset: DashboardPresetId) => {
    setActivePreset(preset);
  };

  const clearFilters = () => {
    setActivePreset("all");
    setSearchValue("");
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitMultiSelect = () => {
    setMultiSelect(false);
    setSelected(new Set());
  };

  const toggleReminderSelect = (id: string) => {
    setReminderSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    const isoDate = new Date(reminderDateTime).toISOString();
    const results = setBulkReminders(Array.from(reminderSelected), isoDate);
    setBulkReminderResults(results);
    setReminderSelected(new Set());
    setShowReminderPicker(false);
    setReminderDateTime("");
  };

  const pendingInvoices = invoices.filter((inv) => inv.status === "Pending");
  const selectedInvoices = invoices.filter((inv) => selected.has(inv.id));
  const presetCounts = useMemo(
    () => getDashboardPresetCounts(invoices),
    [invoices],
  );
  const visibleInvoices = useMemo(
    () => filterDashboardInvoices(invoices, activePreset),
    [invoices, activePreset],
  );

  // Summary stats
  const { totalActive, totalValueLocked, totalReleased } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    let totalValueLocked = 0n;
    let totalReleased = 0n;
    let totalActive = 0;

    for (const inv of invoices) {
      const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
      if (inv.status === "Pending") {
        if (inv.deadline > now) totalActive++;
        totalValueLocked += total;
      } else if (inv.status === "Released") {
        totalReleased += total;
      }
    }

    return { totalActive, totalValueLocked, totalReleased };
  }, [invoices]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

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
              aria-label="Enter multi-select mode to pay multiple invoices"
            >
              Pay Multiple
            </button>
          )}
          {!multiSelect && !reminderSelect && invoices.length > 0 && (
            <button
              onClick={() => { setBulkReminderResults(null); setReminderSelect(true); }}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
              aria-label="Enter multi-select mode to schedule reminders"
            >
              Schedule Reminders
            </button>
          )}
          {multiSelect && (
            <>
              <button
                onClick={exitMultiSelect}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={selected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
                aria-label={`Pay ${selected.size} selected invoice${selected.size !== 1 ? "s" : ""}`}
              >
                Pay Selected ({selected.size})
              </button>
            </>
          )}
          {reminderSelect && (
            <>
              <button
                onClick={exitReminderSelect}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowReminderPicker(true)}
                disabled={reminderSelected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
                aria-label={`Set reminder for ${reminderSelected.size} selected invoice${reminderSelected.size !== 1 ? "s" : ""}`}
              >
                Set Reminder ({reminderSelected.size})
              </button>
            </>
          )}
          <Link
            href="/invoice/new"
            className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => handlePresetToggle("all")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            activePreset === "all"
              ? "bg-indigo-600 text-white"
              : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
          }`}
          aria-pressed={activePreset === "all"}
        >
          All
        </button>
        {DASHBOARD_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          const count = presetCounts[preset.id] ?? 0;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetToggle(preset.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
              aria-pressed={isActive}
            >
              <span>{preset.label}</span>
              <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {count}
              </span>
            </button>
          );
        })}
        {(activePreset !== "all" || searchValue.trim().length > 0) && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Search */}
      <InvoiceSearch
        invoices={invoices}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        numericResult={numericResult}
        loading={searchLoading}
        onNumericResult={setNumericResult}
      />

      {/* Multi-select / reminder selection messages */}
      {multiSelect && (
        <p className="text-sm text-gray-400 mb-4" role="status">
          Select pending invoices to pay in a single transaction.
        </p>
      )}
      {reminderSelect && (
        <p className="text-sm text-gray-400 mb-4" role="status">
          Select invoices to schedule a reminder for.
        </p>
      )}
      {bulkReminderResults && (
        <div className="mb-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reminder scheduling results:</p>
          <ul className="flex flex-col gap-1">
            {bulkReminderResults.map((r) => (
              <li key={r.invoiceId} className="text-xs flex items-center gap-2">
                <span className={r.success ? "text-green-400" : "text-red-400"}>
                  {r.success ? "✓" : "✗"}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Invoice #{r.invoiceId}</span>
                {!r.success && r.error && (
                  <span className="text-red-400">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setBulkReminderResults(null)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Invoice Grid / Empty State */}
      {loading && invoices.length === 0 ? (
        <InvoiceListSkeleton />
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-300 mb-2">No invoices yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Create your first invoice to start receiving payments on-chain.
          </p>
          <Link
            href="/invoice/new"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            + Create your first invoice
          </Link>
        </div>
      ) : visibleInvoices.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-6 text-center">
          <p className="text-gray-400">
            {activePreset === "all"
              ? searchValue.trim()
                ? "No invoices match your search."
                : "No invoices found."
              : DASHBOARD_PRESETS.find((preset) => preset.id === activePreset)
                ?.emptyState ?? "No invoices match this view."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleInvoices.map((inv) => {
            const isSelectable = multiSelect && inv.status === "Pending";
            const isSelected = selected.has(inv.id);
            const isReminderSelectable = reminderSelect;
            const isReminderSelected = reminderSelected.has(inv.id);

            return (
              <div key={inv.id}>
                {isSelectable ? (
                  <button
                    type="button"
                    onClick={() => toggleSelect(inv.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Deselect" : "Select"} Invoice #${inv.id}`}
                    className={`w-full text-left rounded-xl ring-2 transition-all ${
                      isSelected
                        ? "ring-indigo-500"
                        : "ring-transparent hover:ring-gray-600"
                    }`}
                  >
                    <div className="relative">
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold z-10"
                        >
                          ✓
                        </span>
                      )}
                      <InvoiceCard
                        invoice={inv}
                        displayNumber={getOrAssignDisplayNumber(inv.id)}
                      />
                    </div>
                  </button>
                ) : isReminderSelectable ? (
                  <button
                    type="button"
                    onClick={() => toggleReminderSelect(inv.id)}
                    aria-pressed={isReminderSelected}
                    aria-label={`${isReminderSelected ? "Deselect" : "Select"} Invoice #${inv.id} for reminder`}
                    className={`w-full text-left rounded-xl ring-2 transition-all ${
                      isReminderSelected
                        ? "ring-indigo-500"
                        : "ring-transparent hover:ring-gray-600"
                    }`}
                  >
                    <div className="relative">
                      {isReminderSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold z-10"
                        >
                          ✓
                        </span>
                      )}
                      <InvoiceCard
                        invoice={inv}
                        displayNumber={getOrAssignDisplayNumber(inv.id)}
                      />
                    </div>
                  </button>
                ) : (
                  <Link
                    href={`/invoice/${inv.id}`}
                    aria-label={`View Invoice #${inv.id}`}
                    className="block"
                  >
                    <InvoiceCard
                      invoice={inv}
                      displayNumber={getOrAssignDisplayNumber(inv.id)}
                    />
                  </Link>
                )}
              </div>
            );
          })}
          {loading && (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={`skeleton-${i}`}>
                  <SkeletonCard />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Batch Pay Modal */}
      {showBatchModal && publicKey && selectedInvoices.length > 0 && (
        <BatchPayModal
          invoices={selectedInvoices}
          publicKey={publicKey}
          onClose={() => {
            setShowBatchModal(false);
            exitMultiSelect();
          }}
        />
      )}

      {/* Reminder Picker Modal */}
      {showReminderPicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Schedule bulk reminders"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Schedule Reminders</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Applies to {reminderSelected.size} selected invoice{reminderSelected.size !== 1 ? "s" : ""}.
            </p>
            <label htmlFor="bulk-reminder-dt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reminder date &amp; time
            </label>
            <input
              id="bulk-reminder-dt"
              type="datetime-local"
              value={reminderDateTime}
              onChange={(e) => setReminderDateTime(e.target.value)}
              className="w-full min-h-11 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowReminderPicker(false); setReminderDateTime(""); }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleBulkReminders}
                disabled={!reminderDateTime}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
