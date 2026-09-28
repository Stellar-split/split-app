"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";
import RelativeTime from "@/components/ui/RelativeTime";

interface HistoryEntry {
  action: string;
  timestamp: number;
  oldValue?: string;
  newValue?: string;
  address?: string;
  /** Structured diff for the expanded diff view (issue #606). */
  diff?: FieldDiff[];
}

/** A single field change shown in the diff panel. */
interface FieldDiff {
  field: string;
  /** Previous value (undefined = field was added). */
  before?: string;
  /** New value (undefined = field was removed). */
  after?: string;
}

interface Props {
  invoiceId: string;
  /** Optional callback called when the user requests to restore a version. */
  onRestore?: (versionIndex: number, entry: HistoryEntry) => void;
}

// ─── Diff helpers ────────────────────────────────────────────────────────────

/**
 * Build a diff array from a raw audit-log entry.
 * Covers: title, amount, recipients, due date, notes.
 */
function buildDiff(entry: any): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  const action: string = (entry.action ?? entry.type ?? "").toLowerCase();

  // extend_deadline → due date diff
  if (action === "extend_deadline") {
    if (entry.oldDeadline != null && entry.newDeadline != null) {
      diffs.push({
        field: "Due Date",
        before: new Date(entry.oldDeadline * 1000).toLocaleDateString(),
        after: new Date(entry.newDeadline * 1000).toLocaleDateString(),
      });
    }
    return diffs;
  }

  // Generic before/after scalar fields
  const scalarFields: Array<[string, string]> = [
    ["title", "Title"],
    ["amount", "Amount"],
    ["notes", "Notes"],
    ["memo", "Notes"],
  ];

  for (const [key, label] of scalarFields) {
    const before =
      entry[`old${key.charAt(0).toUpperCase() + key.slice(1)}`] ??
      entry[`prev${key.charAt(0).toUpperCase() + key.slice(1)}`];
    const after =
      entry[`new${key.charAt(0).toUpperCase() + key.slice(1)}`] ??
      entry[`next${key.charAt(0).toUpperCase() + key.slice(1)}`];
    if (before != null || after != null) {
      diffs.push({
        field: label,
        before: before != null ? String(before) : undefined,
        after: after != null ? String(after) : undefined,
      });
    }
  }

  // old/newValue generic pair (already-mapped entries)
  if (diffs.length === 0 && (entry.oldValue != null || entry.newValue != null)) {
    diffs.push({
      field: "Value",
      before: entry.oldValue != null ? String(entry.oldValue) : undefined,
      after: entry.newValue != null ? String(entry.newValue) : undefined,
    });
  }

  // Recipient list changes
  const prevRecipients: Array<{ address: string; amount?: string }> =
    entry.prevRecipients ?? entry.oldRecipients ?? [];
  const nextRecipients: Array<{ address: string; amount?: string }> =
    entry.nextRecipients ?? entry.newRecipients ?? [];

  if (prevRecipients.length > 0 || nextRecipients.length > 0) {
    const prevMap = new Map(prevRecipients.map((r) => [r.address, r.amount ?? ""]));
    const nextMap = new Map(nextRecipients.map((r) => [r.address, r.amount ?? ""]));

    // Removed recipients
    for (const [addr, amt] of prevMap) {
      if (!nextMap.has(addr)) {
        diffs.push({
          field: "Recipient",
          before: `${truncateAddress(addr)}${amt ? ` — ${amt}` : ""}`,
          after: undefined,
        });
      }
    }

    // Added recipients
    for (const [addr, amt] of nextMap) {
      if (!prevMap.has(addr)) {
        diffs.push({
          field: "Recipient",
          before: undefined,
          after: `${truncateAddress(addr)}${amt ? ` — ${amt}` : ""}`,
        });
      }
    }

    // Amount changes
    for (const [addr, newAmt] of nextMap) {
      const oldAmt = prevMap.get(addr);
      if (oldAmt !== undefined && oldAmt !== newAmt) {
        diffs.push({
          field: "Recipient Amount",
          before: `${truncateAddress(addr)} — ${oldAmt}`,
          after: `${truncateAddress(addr)} — ${newAmt}`,
        });
      }
    }
  }

  return diffs;
}

// ─── DiffPanel ────────────────────────────────────────────────────────────────

function DiffPanel({ diffs }: { diffs: FieldDiff[] }) {
  if (diffs.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic mt-2">
        No detailed field changes recorded for this entry.
      </p>
    );
  }

  return (
    <div
      className="mt-3 rounded-lg overflow-hidden border border-gray-700 text-xs font-mono"
      aria-label="Field-level diff"
    >
      {diffs.map((d, i) => (
        <div key={i} className="divide-y divide-gray-700">
          {d.before !== undefined && (
            <div className="flex gap-2 px-3 py-1.5 bg-red-950/40">
              <span className="text-red-400 select-none shrink-0">−</span>
              <span className="text-gray-400 shrink-0 min-w-[80px]">{d.field}</span>
              <span className="text-red-300 break-all">{d.before}</span>
            </div>
          )}
          {d.after !== undefined && (
            <div className="flex gap-2 px-3 py-1.5 bg-green-950/40">
              <span className="text-green-400 select-none shrink-0">+</span>
              <span className="text-gray-400 shrink-0 min-w-[80px]">{d.field}</span>
              <span className="text-green-300 break-all">{d.after}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ComparisonView ──────────────────────────────────────────────────────────

interface ComparisonViewProps {
  left: HistoryEntry & { versionNumber: number };
  right: HistoryEntry & { versionNumber: number };
  onClose: () => void;
}

function ComparisonView({ left, right, onClose }: ComparisonViewProps) {
  const leftDiffs = left.diff ?? [];
  const rightDiffs = right.diff ?? [];

  // Build a unified set of field names from both versions
  const allFields = Array.from(
    new Set([...leftDiffs.map((d) => d.field), ...rightDiffs.map((d) => d.field)])
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Version comparison"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Version Comparison</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Comparing v{left.versionNumber} ↔ v{right.versionNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 gap-4 px-6 pt-4 pb-2">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
            v{left.versionNumber} — {left.action}
          </div>
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
            v{right.versionNumber} — {right.action}
          </div>
        </div>

        {/* Comparison body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {allFields.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              No field-level changes recorded for either version.
            </div>
          ) : (
            <div className="space-y-3">
              {allFields.map((field) => {
                const leftDiff = leftDiffs.find((d) => d.field === field);
                const rightDiff = rightDiffs.find((d) => d.field === field);
                return (
                  <div key={field} className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-800 overflow-hidden">
                      <div className="px-3 py-1.5 text-xs font-mono bg-gray-800 text-gray-400 border-b border-gray-700">
                        {field}
                      </div>
                      {leftDiff ? (
                        <div className="text-xs font-mono">
                          {leftDiff.before !== undefined && (
                            <div className="flex gap-2 px-3 py-1.5 bg-red-950/40">
                              <span className="text-red-400 select-none shrink-0">−</span>
                              <span className="text-red-300 break-all">{leftDiff.before}</span>
                            </div>
                          )}
                          {leftDiff.after !== undefined && (
                            <div className="flex gap-2 px-3 py-1.5 bg-green-950/40">
                              <span className="text-green-400 select-none shrink-0">+</span>
                              <span className="text-green-300 break-all">{leftDiff.after}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-600 italic">No change</div>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-800 overflow-hidden">
                      <div className="px-3 py-1.5 text-xs font-mono bg-gray-800 text-gray-400 border-b border-gray-700">
                        {field}
                      </div>
                      {rightDiff ? (
                        <div className="text-xs font-mono">
                          {rightDiff.before !== undefined && (
                            <div className="flex gap-2 px-3 py-1.5 bg-red-950/40">
                              <span className="text-red-400 select-none shrink-0">−</span>
                              <span className="text-red-300 break-all">{rightDiff.before}</span>
                            </div>
                          )}
                          {rightDiff.after !== undefined && (
                            <div className="flex gap-2 px-3 py-1.5 bg-green-950/40">
                              <span className="text-green-400 select-none shrink-0">+</span>
                              <span className="text-green-300 break-all">{rightDiff.after}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-600 italic">No change</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RestoreConfirmModal ──────────────────────────────────────────────────────

interface RestoreConfirmProps {
  versionNumber: number;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function RestoreConfirmModal({ versionNumber, action, onConfirm, onCancel }: RestoreConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm restore"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/40 border border-amber-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Restore Version {versionNumber}?</h3>
            <p className="text-sm text-gray-400 mt-1">
              You are about to restore the state from{" "}
              <span className="font-semibold text-gray-200">{action}</span>. This action will create
              a new version entry in the history.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VersionHistory ───────────────────────────────────────────────────────────

type VersionedEntry = HistoryEntry & { versionNumber: number };

export default function VersionHistory({ invoiceId, onRestore }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Which entry index has its diff panel open. */
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /** Indices selected for comparison (max 2). */
  const [compareSelection, setCompareSelection] = useState<number[]>([]);

  /** Whether comparison modal is open. */
  const [showComparison, setShowComparison] = useState(false);

  /** Index of version pending restore confirmation. */
  const [restoreIndex, setRestoreIndex] = useState<number | null>(null);

  /** Notification message after restore. */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const auditLog = await (splitClient as any).getAuditLog(invoiceId);

        if (!auditLog || auditLog.length === 0) {
          setHistory([]);
          return;
        }

        const entries: HistoryEntry[] = auditLog.map((entry: any) => {
          const action = entry.action || entry.type;
          const timestamp = entry.timestamp || entry.createdAt;

          if (action === "extend_deadline") {
            return {
              action: "Deadline Extended",
              timestamp,
              oldValue: new Date(entry.oldDeadline * 1000).toLocaleDateString(),
              newValue: new Date(entry.newDeadline * 1000).toLocaleDateString(),
              diff: buildDiff(entry),
            };
          } else if (action === "add_co_creator") {
            return {
              action: "Co-creator Added",
              timestamp,
              address: entry.address,
              diff: buildDiff(entry),
            };
          } else if (action === "remove_co_creator") {
            return {
              action: "Co-creator Removed",
              timestamp,
              address: entry.address,
              diff: buildDiff(entry),
            };
          }

          return {
            action:
              action.replace(/_/g, " ").charAt(0).toUpperCase() + action.slice(1),
            timestamp,
            diff: buildDiff(entry),
          };
        });

        setHistory(entries.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [invoiceId]);

  // Assign version numbers: latest is highest number
  const versioned: VersionedEntry[] = history.map((entry, idx) => ({
    ...entry,
    versionNumber: history.length - idx,
  }));

  // Compare selection helpers
  const toggleCompareSelect = (idx: number) => {
    setCompareSelection((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 2) return [prev[1], idx];
      return [...prev, idx];
    });
  };

  const handleCompare = () => {
    if (compareSelection.length === 2) setShowComparison(true);
  };

  const handleRestoreConfirm = () => {
    if (restoreIndex === null) return;
    const entry = versioned[restoreIndex];
    if (onRestore) {
      onRestore(restoreIndex, entry);
    }
    setRestoreNotice(
      `Version ${entry.versionNumber} (${entry.action}) has been queued for restore. A new history entry will be created.`
    );
    setRestoreIndex(null);
    setTimeout(() => setRestoreNotice(null), 5000);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">Loading history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm">Failed to load history</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">No changes recorded for this invoice</p>
      </div>
    );
  }

  const [leftIdx, rightIdx] = compareSelection;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {versioned.length} version{versioned.length !== 1 ? "s" : ""}
          </span>
          {compareSelection.length > 0 && (
            <span className="text-xs bg-indigo-900/50 border border-indigo-700 text-indigo-300 px-2 py-0.5 rounded-full">
              {compareSelection.length}/2 selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {compareSelection.length > 0 && (
            <button
              type="button"
              onClick={() => setCompareSelection([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Clear selection
            </button>
          )}
          <button
            type="button"
            onClick={handleCompare}
            disabled={compareSelection.length !== 2}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            Compare selected
          </button>
        </div>
      </div>

      {/* Restore notice */}
      {restoreNotice && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-900/30 border border-amber-700 text-amber-300 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {restoreNotice}
        </div>
      )}

      {/* Version list */}
      <div className="space-y-4">
        {versioned.map((entry, index) => {
          const isExpanded = expandedIndex === index;
          const isSelected = compareSelection.includes(index);
          const hasDiff =
            (entry.diff?.length ?? 0) > 0 || entry.oldValue != null || entry.newValue != null;
          const isLatest = entry.versionNumber === versioned.length;

          return (
            <div
              key={index}
              className={`flex gap-4 pb-4 border-b border-gray-700 last:border-b-0 ${
                isSelected ? "bg-indigo-950/20 -mx-3 px-3 rounded-xl" : ""
              }`}
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                    isLatest ? "bg-indigo-500 ring-2 ring-indigo-400/40" : "bg-gray-600"
                  }`}
                />
                {index < versioned.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-700 mt-2 min-h-[3rem]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Version badge */}
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border shrink-0 ${
                        isLatest
                          ? "bg-indigo-900/60 border-indigo-700 text-indigo-300"
                          : "bg-gray-800 border-gray-700 text-gray-400"
                      }`}
                    >
                      v{entry.versionNumber}
                      {isLatest && <span className="ml-1 text-indigo-400">• latest</span>}
                    </span>
                    <p className="font-semibold text-gray-200 text-sm">{entry.action}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Select for compare */}
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleCompareSelect(index)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-indigo-700 border-indigo-600 text-white"
                          : "border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      {isSelected ? "✓ Selected" : "Select"}
                    </button>

                    {/* Restore button (not shown for latest) */}
                    {!isLatest && (
                      <button
                        type="button"
                        onClick={() => setRestoreIndex(index)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-amber-700 text-amber-400 hover:bg-amber-900/30 transition-colors"
                      >
                        Restore
                      </button>
                    )}

                    {/* "Show diff" toggle button */}
                    {hasDiff && (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Hide changes" : "Show changes"}
                        onClick={() =>
                          setExpandedIndex((prev) => (prev === index ? null : index))
                        }
                        className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-0.5 rounded border border-indigo-800 hover:border-indigo-600"
                      >
                        {isExpanded ? "Hide diff" : "Show diff"}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  <RelativeTime
                    iso={new Date(entry.timestamp * 1000).toISOString()}
                  />
                </p>

                {/* Legacy inline diff (always shown for extend_deadline) */}
                {entry.oldValue && entry.newValue && !isExpanded && (
                  <div className="mt-2 text-sm space-y-1">
                    <p className="text-red-400">
                      <span className="font-mono">- {entry.oldValue}</span>
                    </p>
                    <p className="text-green-400">
                      <span className="font-mono">+ {entry.newValue}</span>
                    </p>
                  </div>
                )}

                {entry.address && (
                  <p className="mt-2 text-sm font-mono text-gray-300">
                    {truncateAddress(entry.address)}
                  </p>
                )}

                {/* Expanded diff panel (issue #606) */}
                {isExpanded && (
                  <DiffPanel
                    diffs={
                      entry.diff && entry.diff.length > 0
                        ? entry.diff
                        : entry.oldValue || entry.newValue
                        ? [
                            {
                              field: "Value",
                              before: entry.oldValue,
                              after: entry.newValue,
                            },
                          ]
                        : []
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison modal */}
      {showComparison && compareSelection.length === 2 && (
        <ComparisonView
          left={versioned[leftIdx]}
          right={versioned[rightIdx]}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Restore confirm modal */}
      {restoreIndex !== null && (
        <RestoreConfirmModal
          versionNumber={versioned[restoreIndex].versionNumber}
          action={versioned[restoreIndex].action}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreIndex(null)}
        />
      )}
    </div>
  );
}
