"use client";

import { useState, useEffect, useCallback } from "react";
import type { RecipientLine, SplitMeta } from "@/hooks/useSplitCalculator";
import { useSplitCalculator, defaultRecipientLine } from "@/hooks/useSplitCalculator";

const STROOP_SCALE = 1e7;

type SplitMode = "percent" | "fixed";

interface SplitBuilderProps {
  initialTotal?: number;
  initialAssetCode?: "XLM" | "USDC";
  initialRecipients?: RecipientLine[];
  splitMeta?: SplitMeta;
  onSplitMetaChange?: (meta: SplitMeta) => void;
  readOnly?: boolean;
}

interface RecipientWithAmount extends RecipientLine {
  fixedAmount?: number;
}

export default function SplitBuilder({
  initialTotal = 0,
  initialAssetCode = "USDC",
  initialRecipients,
  splitMeta: externalSplitMeta,
  onSplitMetaChange,
  readOnly = false,
}: SplitBuilderProps) {
  const [mode, setMode] = useState<SplitMode>("percent");
  const [totalAmount, setTotalAmount] = useState<string>(
    externalSplitMeta ? String(externalSplitMeta.totalAmount) : String(initialTotal)
  );
  const [assetCode, setAssetCode] = useState<"XLM" | "USDC">(
    externalSplitMeta?.assetCode ?? initialAssetCode
  );
  const [recipients, setRecipients] = useState<RecipientWithAmount[]>(() => {
    if (externalSplitMeta?.recipients?.length) {
      return externalSplitMeta.recipients;
    }
    if (initialRecipients?.length) {
      return initialRecipients;
    }
    return [];
  });

  const parsedTotal = Math.max(0, parseFloat(totalAmount) || 0);

  const result = useSplitCalculator(parsedTotal, recipients, assetCode);

  useEffect(() => {
    if (!onSplitMetaChange) return;
    const meta: SplitMeta = {
      totalAmount: parsedTotal,
      assetCode,
      recipients,
    };
    onSplitMetaChange(meta);
  }, [parsedTotal, assetCode, recipients, onSplitMetaChange]);

  const handleSwitchMode = useCallback((newMode: SplitMode) => {
    if (readOnly || newMode === mode) return;

    setRecipients((prev) => {
      if (newMode === "fixed" && mode === "percent") {
        return prev.map((r) => ({
          ...r,
          fixedAmount: (parsedTotal * (r.sharePercent || 0)) / 100,
        }));
      } else if (newMode === "percent" && mode === "fixed") {
        return prev.map((r) => {
          const fixedAmount = r.fixedAmount || 0;
          const sharePercent = parsedTotal > 0 ? (fixedAmount / parsedTotal) * 100 : 0;
          return { ...r, sharePercent };
        });
      }
      return prev;
    });

    setMode(newMode);
  }, [mode, readOnly, parsedTotal]);

  const updateRecipient = (index: number, patch: Partial<RecipientWithAmount>) => {
    if (readOnly) return;
    setRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const addRecipient = () => {
    if (readOnly) return;
    const newRecipient = defaultRecipientLine();
    if (mode === "fixed") {
      (newRecipient as RecipientWithAmount).fixedAmount = 0;
    }
    setRecipients((prev) => [...prev, newRecipient]);
  };

  const removeRecipient = (index: number) => {
    if (readOnly) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const allocatedAmount = recipients.reduce(
    (sum, r) => sum + (r.fixedAmount || 0),
    0
  );
  const remainingAmount = Math.max(0, parsedTotal - allocatedAmount);

  const STROOP_TOLERANCE = 1; // 1 stroop = 1e-7
  const allocationError = Math.abs(remainingAmount * STROOP_SCALE - Math.round(remainingAmount * STROOP_SCALE));
  const isBalanced = allocationError < STROOP_TOLERANCE || parsedTotal === 0;
  const canSubmit = isBalanced || mode === "percent";

  return (
    <section className="mb-8 bg-gray-800/40 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">Split Builder</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSwitchMode("percent")}
            disabled={readOnly}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mode === "percent"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            % Percentage
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("fixed")}
            disabled={readOnly}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mode === "fixed"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            XLM Amount
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label htmlFor="builder-total" className="block text-sm font-medium text-gray-300 mb-1">
            Total Invoice Amount
          </label>
          <input
            id="builder-total"
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
          <label htmlFor="builder-asset" className="block text-sm font-medium text-gray-300 mb-1">
            Asset
          </label>
          <select
            id="builder-asset"
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

      {mode === "fixed" && !isBalanced && (
        <div role="alert" className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          Allocation does not match invoice total within tolerance
        </div>
      )}

      {mode === "fixed" && (
        <div className="mb-4 text-sm text-gray-300 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2">
          Remaining Unallocated: <span className="font-mono font-semibold">{remainingAmount.toFixed(7)} {assetCode}</span>
        </div>
      )}

      <div className="space-y-3 mb-5">
        {recipients.length === 0 && !readOnly && (
          <p className="text-sm text-gray-500 text-center py-6">
            No recipients yet. Click &ldquo;+ Add Recipient&rdquo; to begin.
          </p>
        )}

        {recipients.map((line, index) => (
          <div key={index} className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Recipient #{index + 1}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Address</label>
              <input
                type="text"
                value={line.address}
                onChange={(e) => updateRecipient(index, { address: e.target.value })}
                disabled={readOnly}
                placeholder="G..."
                className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
              />
            </div>

            {mode === "percent" ? (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Share %
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="100"
                  value={line.sharePercent}
                  onChange={(e) =>
                    updateRecipient(index, { sharePercent: parseFloat(e.target.value) || 0 })
                  }
                  disabled={readOnly}
                  className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Amount ({assetCode})
                </label>
                <input
                  type="number"
                  step="0.0000001"
                  min="0"
                  value={line.fixedAmount || 0}
                  onChange={(e) =>
                    updateRecipient(index, { fixedAmount: parseFloat(e.target.value) || 0 })
                  }
                  disabled={readOnly}
                  className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRecipient}
          className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + Add Recipient
        </button>
      )}
    </section>
  );
}
