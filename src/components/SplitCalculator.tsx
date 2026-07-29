"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useSplitCalculator,
  defaultRecipientLine,
  type RecipientLine,
  type SplitMeta,
} from "@/hooks/useSplitCalculator";
import { moveItem } from "@/lib/reorder";
import { getEmailForAddress } from "@/lib/addressBook";
import { MAX_RECIPIENTS } from "@/lib/stellar";
import Avatar from "@/components/ui/Avatar";
import RangeSlider from "@/components/ui/RangeSlider";
import SplitSumIndicator from "@/components/invoice/SplitSumIndicator";

interface SplitCalculatorProps {
  initialTotal?: string;
  initialAssetCode?: "XLM" | "USDC";
  initialRecipients?: RecipientLine[];
  splitMeta?: SplitMeta;
  onSplitMetaChange?: (meta: SplitMeta) => void;
  readOnly?: boolean;
}

function formatStroop(value: number): string {
  return value.toFixed(7);
}

export default function SplitCalculator({
  initialTotal = "",
  initialAssetCode = "USDC",
  initialRecipients,
  splitMeta: externalSplitMeta,
  onSplitMetaChange,
  readOnly = false,
}: SplitCalculatorProps) {
  const [totalAmount, setTotalAmount] = useState<string>(
    externalSplitMeta ? String(externalSplitMeta.totalAmount) : initialTotal
  );
  const [assetCode, setAssetCode] = useState<"XLM" | "USDC">(
    externalSplitMeta?.assetCode ?? initialAssetCode
  );
  const [recipients, setRecipients] = useState<RecipientLine[]>(() => {
    if (externalSplitMeta?.recipients?.length) {
      return externalSplitMeta.recipients;
    }
    if (initialRecipients?.length) {
      return initialRecipients;
    }
    return [];
  });

  useEffect(() => {
    if (!externalSplitMeta) return;
    setTotalAmount(String(externalSplitMeta.totalAmount));
    setAssetCode(externalSplitMeta.assetCode);
    setRecipients(externalSplitMeta.recipients);
  }, [externalSplitMeta]);

  const parsedTotal = useMemo(() => {
    const n = parseFloat(totalAmount);
    return isFinite(n) && n >= 0 ? n : 0;
  }, [totalAmount]);

  const result = useSplitCalculator(parsedTotal, recipients, assetCode);
  const { derivedLines, totalGross, totalTax, totalFees, totalNet, validation, canAddRecipient, recipientCount } = result;

  useEffect(() => {
    if (!onSplitMetaChange) return;
    const meta: SplitMeta = {
      totalAmount: parsedTotal,
      assetCode,
      recipients,
    };
    onSplitMetaChange(meta);
  }, [parsedTotal, assetCode, recipients, onSplitMetaChange]);

  const updateRecipient = (index: number, patch: Partial<RecipientLine>) => {
    if (readOnly) return;
    setRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const addRecipient = () => {
    if (readOnly) return;
    const newPercent = recipients.length === 0 ? 100 : 0;
    setRecipients((prev) => [
      ...prev,
      { ...defaultRecipientLine(), sharePercent: newPercent },
    ]);
  };

  const removeRecipient = (index: number) => {
    if (readOnly) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const equalizeShares = () => {
    if (readOnly || recipients.length === 0) return;
    const base = 100 / recipients.length;
    const baseFloor = Math.floor(base * 10000) / 10000;
    setRecipients((prev) =>
      prev.map((r, i) => {
        if (i < prev.length - 1) {
          return { ...r, sharePercent: baseFloor };
        }
        const used = baseFloor * (prev.length - 1);
        return { ...r, sharePercent: Math.round((100 - used) * 10000) / 10000 };
      })
    );
  };

  // ── Recipient avatars ────────────────────────────────────────────────────
  // Emails live in localStorage, so they can only be resolved after mount;
  // rendering the deterministic avatar on both passes keeps hydration stable.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const addressKey = recipients.map((r) => r.address).join("|");
  const emailByAddress = useMemo(() => {
    if (!mounted) return {} as Record<string, string | undefined>;
    const map: Record<string, string | undefined> = {};
    for (const address of addressKey.split("|")) {
      if (address && map[address] === undefined) {
        map[address] = getEmailForAddress(address);
      }
    }
    return map;
    // addressKey is the serialized dependency for `recipients`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey, mounted]);

  // ── Reordering (drag + keyboard) ─────────────────────────────────────────
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // A row is only draggable while its own handle is held, so text selection
  // inside the address/percent inputs keeps working.
  const [handleHeldIndex, setHandleHeldIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const handleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocusIndex.current === null) return;
    handleRefs.current[pendingFocusIndex.current]?.focus();
    pendingFocusIndex.current = null;
  });

  const reorderRecipients = useCallback(
    (from: number, to: number, { focusHandle = false } = {}) => {
      if (readOnly) return;
      if (from === to || to < 0 || to >= recipients.length) return;

      // moveItem relocates the recipient object as-is — share percentages,
      // tax rates and fees travel with the row and are never recalculated.
      setRecipients((prev) => moveItem(prev, from, to));
      setAnnouncement(
        `Recipient moved from position ${from + 1} to position ${to + 1} of ${
          recipients.length
        }.`
      );
      if (focusHandle) pendingFocusIndex.current = to;
    },
    [readOnly, recipients.length]
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    if (readOnly || handleHeldIndex !== index) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // Firefox requires data to be set for a drag to start at all.
      e.dataTransfer.setData("text/plain", String(index));
    }
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    if (readOnly || draggedIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    if (readOnly || draggedIndex === null) return;
    e.preventDefault();
    reorderRecipients(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setHandleHeldIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setHandleHeldIndex(null);
  };

  const handleHandleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (readOnly) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      reorderRecipients(index, index - 1, { focusHandle: true });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      reorderRecipients(index, index + 1, { focusHandle: true });
    }
  };

  const maxShare = Math.max(...derivedLines.map((l) => l.sharePercent), 0.0001);
  const shareSum = derivedLines.reduce((s, l) => s + (l.sharePercent || 0), 0);

  return (
    <section className="mb-8 bg-gray-800/40 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">Split Calculator</h2>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={equalizeShares}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              Equalize Shares
            </button>
            <button
              type="button"
              onClick={addRecipient}
              disabled={!canAddRecipient}
              title={!canAddRecipient ? `Maximum ${MAX_RECIPIENTS} recipients reached` : undefined}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              + Add Line
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label
            htmlFor="split-total"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Gross Total Amount
          </label>
          <input
            id="split-total"
            type="number"
            step="0.0000001"
            min="0"
            placeholder="0.0000000"
            value={totalAmount}
            onChange={(e) => !readOnly && setTotalAmount(e.target.value)}
            disabled={readOnly}
            className="w-full min-h-11 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
          />
        </div>
        <div>
          <label
            htmlFor="split-asset"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Asset
          </label>
          <select
            id="split-asset"
            value={assetCode}
            onChange={(e) => !readOnly && setAssetCode(e.target.value as "XLM" | "USDC")}
            disabled={readOnly}
            className="w-full min-h-11 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
          >
            <option value="USDC">USDC</option>
            <option value="XLM">XLM</option>
          </select>
        </div>
      </div>

      {validation.errorMessage && (
        <div
          role="alert"
          className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2"
        >
          {validation.errorMessage}
        </div>
      )}

      {derivedLines.length > 0 && (
        <SplitSumIndicator sum={shareSum} isValid={validation.sharesSumTo100} />
      )}

      {derivedLines.length > 0 && parsedTotal > 0 && (
        <div className="mb-5 bg-gray-900 rounded-lg p-3">
          <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 bg-gray-800">
            {derivedLines.map((l, i) => (
              <div
                key={i}
                className="transition-all"
                style={{
                  width: `${(l.sharePercent / maxShare) * 100}%`,
                  backgroundColor: [
                    "#4f46e5",
                    "#0891b2",
                    "#059669",
                    "#d97706",
                    "#dc2626",
                    "#7c3aed",
                  ][i % 6],
                  opacity: 0.15 + (l.sharePercent / maxShare) * 0.85,
                }}
                title={`${l.sharePercent.toFixed(2)}%`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Announces keyboard reordering to screen readers. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="space-y-3 mb-5">
        {derivedLines.length === 0 && !readOnly && (
          <p className="text-sm text-gray-500 text-center py-6">
            No recipients yet. Click "Add Line" to begin.
          </p>
        )}

        {derivedLines.map((line, index) => (
          <div
            key={index}
            data-testid={`recipient-row-${index}`}
            draggable={!readOnly && handleHeldIndex === index}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`bg-gray-900/60 border rounded-lg p-4 space-y-3 transition-colors ${
              draggedIndex === index ? "opacity-50" : ""
            } ${
              dragOverIndex === index && draggedIndex !== index
                ? "border-indigo-400 ring-2 ring-indigo-500/60"
                : "border-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {!readOnly && (
                <button
                  type="button"
                  ref={(el) => {
                    handleRefs.current[index] = el;
                  }}
                  onMouseDown={() => setHandleHeldIndex(index)}
                  onTouchStart={() => setHandleHeldIndex(index)}
                  onMouseUp={() => setHandleHeldIndex(null)}
                  onKeyDown={handleHandleKeyDown(index)}
                  aria-label={`Reorder recipient ${index + 1} of ${
                    derivedLines.length
                  }. Use the up and down arrow keys to move it.`}
                  title="Drag to reorder, or use arrow keys"
                  data-testid={`drag-handle-${index}`}
                  className="shrink-0 cursor-grab rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:cursor-grabbing"
                >
                  {/* Grip icon */}
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="9" cy="6" r="1.6" />
                    <circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" />
                    <circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" />
                    <circle cx="15" cy="18" r="1.6" />
                  </svg>
                </button>
              )}

              <Avatar
                address={line.address}
                email={emailByAddress[line.address]}
                size={32}
              />

              <span className="text-xs font-medium text-gray-400">
                Recipient #{index + 1}
              </span>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
                  aria-label={`Remove recipient ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Address
              </label>
              <input
                type="text"
                value={line.address}
                onChange={(e) =>
                  updateRecipient(index, { address: e.target.value })
                }
                disabled={readOnly}
                placeholder="G..."
                className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`share-percent-${index}`}
                  className="block text-xs font-medium text-gray-400"
                >
                  Share %
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="100"
                  aria-label={`Recipient ${index + 1} share percentage, exact value`}
                  value={line.sharePercent}
                  onChange={(e) =>
                    updateRecipient(index, {
                      sharePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                  className="w-24 min-h-8 bg-gray-950 border border-gray-700 rounded-md px-2 py-1 text-right text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
              <RangeSlider
                id={`share-percent-${index}`}
                value={line.sharePercent}
                onChange={(next) =>
                  updateRecipient(index, { sharePercent: next })
                }
                disabled={readOnly}
                ariaLabel={`Recipient ${index + 1} share percentage`}
                ariaValueText={`${line.sharePercent}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Tax Rate %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={line.taxRatePercent}
                  onChange={(e) =>
                    updateRecipient(index, {
                      taxRatePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                  className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Fixed Fee ({assetCode})
                </label>
                <input
                  type="number"
                  step="0.0000001"
                  min="0"
                  value={line.fixedFeeXLM}
                  onChange={(e) =>
                    updateRecipient(index, {
                      fixedFeeXLM: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                  className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-700/60 text-xs">
              <div>
                <span className="text-gray-500">Gross:</span>
                <div className="font-mono text-gray-300 mt-0.5">
                  {formatStroop(line.grossAmount)} {assetCode}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Tax:</span>
                <div className="font-mono text-orange-400 mt-0.5">
                  - {formatStroop(line.effectiveTaxAmount)} {assetCode}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Net:</span>
                <div className="font-mono text-indigo-300 font-semibold mt-0.5">
                  {formatStroop(line.netAmount)} {assetCode}
                </div>
              </div>
            </div>
          </div>
        ))}
        {recipientCount > 0 && (
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700/40">
            {recipientCount} / {MAX_RECIPIENTS} recipients
          </div>
        )}
      </div>

      {parsedTotal > 0 && derivedLines.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg divide-y divide-gray-700/60 text-sm">
          <div className="px-4 py-2.5 flex justify-between">
            <span className="text-gray-400">Gross Total</span>
            <span className="font-mono text-gray-200">
              {formatStroop(totalGross)} {assetCode}
            </span>
          </div>
          <div className="px-4 py-2.5 flex justify-between">
            <span className="text-gray-400">Total Tax Withheld</span>
            <span className="font-mono text-orange-400">
              - {formatStroop(totalTax)} {assetCode}
            </span>
          </div>
          <div className="px-4 py-2.5 flex justify-between">
            <span className="text-gray-400">Total Fixed Fees</span>
            <span className="font-mono text-red-400">
              - {formatStroop(totalFees)} {assetCode}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between bg-indigo-950/40 rounded-b-lg">
            <span className="font-medium text-gray-200">Net Payout Total</span>
            <span className="font-mono text-indigo-300 font-bold text-base">
              {formatStroop(totalNet)} {assetCode}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
