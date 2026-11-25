"use client";

import { useState } from "react";
import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import {
  findAllDuplicates,
  mergeInvoiceGroup,
  undoMerge,
  describeDifferences,
  type DuplicateGroup,
  type MergeStrategy,
} from "@/lib/invoiceDuplicates";

// ── Helper ────────────────────────────────────────────────────────────────────

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function totalAmount(inv: Invoice): bigint {
  return inv.recipients.reduce((s, r) => s + r.amount, 0n);
}

function formatDeadline(deadline: number): string {
  if (!deadline) return "No deadline";
  return new Date(deadline * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: DuplicateGroup;
  onMerge: (group: DuplicateGroup, strategy: MergeStrategy) => void;
}

function DuplicateGroupCard({ group, onMerge }: GroupCardProps) {
  const [strategy, setStrategy] = useState<MergeStrategy>("keep-newest");
  const [expanded, setExpanded] = useState(false);

  const diffs =
    group.invoices.length === 2
      ? describeDifferences(group.invoices[0], group.invoices[1])
      : [];

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 text-left transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span
            className={[
              "text-xs font-bold px-2 py-0.5 rounded-full",
              group.confidence === 1.0
                ? "bg-red-900/60 text-red-300"
                : "bg-amber-900/60 text-amber-300",
            ].join(" ")}
          >
            {group.confidence === 1.0 ? "Exact" : "Fuzzy"} · {Math.round(group.confidence * 100)}%
          </span>
          <span className="text-sm text-gray-200 font-medium">
            {group.invoices.length} duplicate invoices
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Reason */}
          <p className="text-xs text-gray-400 italic">{group.reason}</p>

          {/* Differences */}
          {diffs.length > 0 && (
            <ul className="space-y-1">
              {diffs.map((diff, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-400">
                  <span aria-hidden="true">⚠</span>
                  {diff}
                </li>
              ))}
            </ul>
          )}

          {/* Invoice list */}
          <div className="space-y-2">
            {group.invoices.map((inv) => (
              <div
                key={String(inv.id)}
                className="flex flex-wrap items-center justify-between gap-2 bg-gray-900 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">
                    #{String(inv.id)}
                  </span>
                  <span
                    className={[
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      inv.status === "Released"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : inv.status === "Refunded"
                          ? "bg-purple-900/50 text-purple-300"
                          : "bg-blue-900/50 text-blue-300",
                    ].join(" ")}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  <span>{formatAmount(totalAmount(inv))} USDC</span>
                  <span className="text-gray-500">{formatDeadline(inv.deadline)}</span>
                  <span className="text-gray-500">
                    {inv.recipients.length} recipient{inv.recipients.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Merge controls */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-300">
              <span>Keep:</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as MergeStrategy)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="keep-newest">Newest invoice</option>
                <option value="keep-oldest">Oldest invoice</option>
                <option value="keep-largest">Largest amount</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => onMerge(group, strategy)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Merge duplicates
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  invoices: Invoice[];
  onClose: () => void;
  /** Called after a merge so the parent can refresh its invoice list. */
  onMerged?: (result: { primaryId: string; mergedIds: string[] }) => void;
}

/**
 * DuplicateMergeModal — detects duplicate invoices and lets the user merge
 * them by nominating a primary invoice and hiding the rest.
 *
 * Issue #813: Implement invoice duplicate detection and merge.
 */
export default function DuplicateMergeModal({
  invoices,
  onClose,
  onMerged,
}: Props) {
  const [groups] = useState<DuplicateGroup[]>(() => findAllDuplicates(invoices));
  const [mergeResults, setMergeResults] = useState<
    Array<{ primaryId: string; mergedIds: string[]; totalAmount: string }>
  >([]);
  const [lastUndo, setLastUndo] = useState<string[] | null>(null);

  const handleMerge = (group: DuplicateGroup, strategy: MergeStrategy) => {
    const result = mergeInvoiceGroup(group, strategy);
    setMergeResults((prev) => [result, ...prev]);
    setLastUndo(result.mergedIds);
    onMerged?.({ primaryId: result.primaryId, mergedIds: result.mergedIds });
  };

  const handleUndo = () => {
    if (!lastUndo) return;
    undoMerge(lastUndo);
    setMergeResults((prev) =>
      prev.filter((r) => r.mergedIds.join(",") !== lastUndo!.join(",")),
    );
    setLastUndo(null);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2
              id="duplicate-modal-title"
              className="text-lg font-bold text-gray-100"
            >
              Duplicate Invoice Detection
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {groups.length === 0
                ? "No duplicates found in the current list."
                : `Found ${groups.length} duplicate group${groups.length !== 1 ? "s" : ""} across ${invoices.length} invoices.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Merge results summary */}
        {mergeResults.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-emerald-900/30 border border-emerald-700/40 rounded-lg flex-shrink-0">
            <p className="text-sm text-emerald-300 font-semibold">
              {mergeResults.length} merge{mergeResults.length !== 1 ? "s" : ""} applied
            </p>
            {lastUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className="mt-1 text-xs text-emerald-400 underline hover:text-emerald-300 transition-colors"
              >
                Undo last merge
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {groups.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3" aria-hidden="true">✅</div>
              <p className="text-gray-300 font-semibold">All clear!</p>
              <p className="text-sm text-gray-500 mt-1">
                No duplicate invoices were detected.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <DuplicateGroupCard
                key={group.key}
                group={group}
                onMerge={handleMerge}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-500 flex-1">
            Merged invoices are hidden locally; no on-chain changes are made.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
