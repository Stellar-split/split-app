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
    const before = entry[`old${key.charAt(0).toUpperCase() + key.slice(1)}`] ??
      entry[`prev${key.charAt(0).toUpperCase() + key.slice(1)}`];
    const after = entry[`new${key.charAt(0).toUpperCase() + key.slice(1)}`] ??
      entry[`next${key.charAt(0).toUpperCase() + key.slice(1)}`];
    if (before != null || after != null) {
      diffs.push({ field: label, before: before != null ? String(before) : undefined, after: after != null ? String(after) : undefined });
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

// ─── VersionHistory ───────────────────────────────────────────────────────────

export default function VersionHistory({ invoiceId }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Which entry index has its diff panel open. */
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const isExpanded = expandedIndex === index;
        const hasDiff = (entry.diff?.length ?? 0) > 0 ||
          entry.oldValue != null ||
          entry.newValue != null;

        return (
          <div
            key={index}
            className="flex gap-4 pb-4 border-b border-gray-700 last:border-b-0"
          >
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1 shrink-0" />
              {index < history.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-700 mt-2 min-h-[3rem]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-200">{entry.action}</p>

                {/* "Show diff" toggle button */}
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
  );
}
