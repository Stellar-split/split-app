"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useSplitCalculator,
  defaultRecipientLine,
  type RecipientLine,
  type SplitMeta,
} from "@/hooks/useSplitCalculator";

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
  const { derivedLines, totalGross, totalTax, totalFees, totalNet, validation } = result;

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

  const maxShare = Math.max(...derivedLines.map((l) => l.sharePercent), 0.0001);

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
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
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

      <div className="space-y-3 mb-5">
        {derivedLines.length === 0 && !readOnly && (
          <p className="text-sm text-gray-500 text-center py-6">
            No recipients yet. Click "Add Line" to begin.
          </p>
        )}

        {derivedLines.map((line, index) => (
          <div
            key={index}
            className="bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">
                Recipient #{index + 1}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
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

            <div className="grid grid-cols-3 gap-3">
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
                    updateRecipient(index, {
                      sharePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                  className="w-full min-h-9 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
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
