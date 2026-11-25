"use client";

import React, { useState, useEffect, useMemo } from "react";
import { splitClient } from "@/lib/stellar";

export type HistoryEventType = "payment" | "release" | "note" | "status_change";

export type HistoryFilter = "all" | "payments" | "releases" | "notes" | "status_changes";

export interface HistoryEntry {
  id: string;
  eventType: HistoryEventType;
  actor: string;
  amount?: string | number;
  currency?: string;
  details?: string;
  timestamp: number; // Unix timestamp in milliseconds
  txHash?: string;
}

export interface HistoryLogProps {
  invoiceId: string;
  initialEntries?: HistoryEntry[];
  className?: string;
}

function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatRelativeTime(timestampMs: number, now = Date.now()): string {
  const diffSec = Math.floor((now - timestampMs) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(timestampMs).toLocaleDateString();
}

export const EVENT_ICONS: Record<HistoryEventType, string> = {
  payment: "💳",
  release: "🚀",
  note: "📝",
  status_change: "🔄",
};

export const EVENT_LABELS: Record<HistoryEventType, string> = {
  payment: "Payment",
  release: "Release",
  note: "Note",
  status_change: "Status Change",
};

export const FILTER_CHIPS: { id: HistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "payments", label: "Payments" },
  { id: "releases", label: "Releases" },
  { id: "notes", label: "Notes" },
  { id: "status_changes", label: "Status Changes" },
];

export function filterHistoryEntries(
  entries: HistoryEntry[],
  filter: HistoryFilter
): HistoryEntry[] {
  if (filter === "all") return entries;
  if (filter === "payments") return entries.filter((e) => e.eventType === "payment");
  if (filter === "releases") return entries.filter((e) => e.eventType === "release");
  if (filter === "notes") return entries.filter((e) => e.eventType === "note");
  if (filter === "status_changes") return entries.filter((e) => e.eventType === "status_change");
  return entries;
}

export default function HistoryLog({
  invoiceId,
  initialEntries,
  className = "",
}: HistoryLogProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>(initialEntries || []);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [isCompact, setIsCompact] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(!initialEntries);

  useEffect(() => {
    if (initialEntries) {
      setEntries(initialEntries);
      return;
    }

    async function loadHistory() {
      setLoading(true);
      try {
        const client = splitClient as any;
        // Attempt get_history on contract SDK or API
        if (typeof client?.get_history === "function") {
          const raw = await client.get_history(invoiceId);
          if (Array.isArray(raw)) {
            setEntries(raw);
            return;
          }
        }
        if (typeof client?.getInvoiceHistory === "function") {
          const raw = await client.getInvoiceHistory(invoiceId);
          if (Array.isArray(raw)) {
            setEntries(raw);
            return;
          }
        }

        // Fetch from API route or invoice details
        const res = await fetch(`/api/invoices/${invoiceId}/history`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.payments)) {
            const mapped: HistoryEntry[] = json.payments.map((p: any, idx: number) => ({
              id: `pmt-${idx}`,
              eventType: "payment",
              actor: p.payer || "Unknown",
              amount: p.amount ? (Number(p.amount) / 10_000_000).toFixed(2) : undefined,
              currency: "USDC",
              details: "Payment received",
              timestamp: p.timestamp ? p.timestamp * 1000 : Date.now() - idx * 3600000,
            }));
            setEntries(mapped);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load invoice history:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [invoiceId, initialEntries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return filterHistoryEntries(entries, filter);
  }, [entries, filter]);

  const visibleEntries = useMemo(() => {
    return filteredEntries.slice(0, visibleCount);
  }, [filteredEntries, visibleCount]);

  const hasMore = filteredEntries.length > visibleCount;

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(filteredEntries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoiceId}-history.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>On-Chain History Log</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-gray-800 text-gray-300 border border-gray-700">
              {filteredEntries.length} {filteredEntries.length === 1 ? "event" : "events"}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Interactive event buffer recording verifiable on-chain invoice activities.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Compact View Toggle */}
          <button
            type="button"
            onClick={() => setIsCompact(!isCompact)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isCompact
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
            }`}
            aria-pressed={isCompact}
            title={isCompact ? "Switch to detailed view" : "Switch to compact timeline view"}
          >
            {isCompact ? "Detailed View" : "Compact Timeline"}
          </button>

          {/* JSON Export Button */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors border border-gray-700 flex items-center gap-1.5"
              aria-label="Export history as JSON"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6" role="tablist" aria-label="History event type filters">
        {FILTER_CHIPS.map((chip) => {
          const isActive = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setFilter(chip.id);
                setVisibleCount(10);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-8 text-center text-gray-500 animate-pulse text-sm">
          Loading history records…
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEntries.length === 0 && (
        <div className="py-12 text-center text-gray-500 bg-gray-800/30 border border-gray-800 rounded-xl">
          <p className="text-sm font-medium">No history yet</p>
          <p className="text-xs text-gray-600 mt-1">
            {filter !== "all"
              ? `No events match the "${FILTER_CHIPS.find((c) => c.id === filter)?.label}" filter.`
              : "No on-chain activity has occurred for this invoice yet."}
          </p>
        </div>
      )}

      {/* Event List (Detailed vs Compact) */}
      {!loading && filteredEntries.length > 0 && (
        <div className="space-y-3">
          {isCompact ? (
            /* Compact Timeline View */
            <div className="border-l-2 border-gray-800 ml-3 pl-4 space-y-3 py-1">
              {visibleEntries.map((entry) => {
                const absTime = new Date(entry.timestamp).toLocaleString();
                const relTime = formatRelativeTime(entry.timestamp);
                return (
                  <div key={entry.id} className="relative flex items-center justify-between gap-3 text-xs">
                    {/* Timeline node dot */}
                    <span className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-gray-900" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span title={EVENT_LABELS[entry.eventType]}>
                        {EVENT_ICONS[entry.eventType]}
                      </span>
                      <span className="font-semibold text-gray-200 truncate">
                        {EVENT_LABELS[entry.eventType]}
                      </span>
                      <span className="font-mono text-gray-400">
                        by {truncateAddress(entry.actor)}
                      </span>
                      {entry.amount && (
                        <span className="text-green-400 font-medium">
                          +{entry.amount} {entry.currency || "USDC"}
                        </span>
                      )}
                    </div>
                    <span
                      title={absTime}
                      className="text-gray-500 cursor-help shrink-0 hover:text-gray-300 transition-colors"
                    >
                      {relTime}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Detailed View */
            <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
              {visibleEntries.map((entry) => {
                const absTime = new Date(entry.timestamp).toLocaleString();
                const relTime = formatRelativeTime(entry.timestamp);
                return (
                  <li
                    key={entry.id}
                    className="p-4 bg-gray-800/40 hover:bg-gray-800/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                        {EVENT_ICONS[entry.eventType]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">
                            {EVENT_LABELS[entry.eventType]}
                          </span>
                          {entry.amount && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-950/60 border border-green-800 text-green-300">
                              +{entry.amount} {entry.currency || "USDC"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Actor:{" "}
                          <span className="font-mono text-gray-300" title={entry.actor}>
                            {truncateAddress(entry.actor, 8)}
                          </span>
                          {entry.details && ` • ${entry.details}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:self-center">
                      <span
                        title={absTime}
                        className="text-xs text-gray-500 cursor-help hover:text-gray-300 transition-colors"
                      >
                        {relTime}
                      </span>
                      {entry.txHash && (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline"
                          title="View on Stellar Expert"
                        >
                          Tx ↗
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 10)}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-gray-700"
              >
                Load more ({filteredEntries.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
