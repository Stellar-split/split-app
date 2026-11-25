"use client";

import { formatAmount, parseAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import { useState } from "react";

interface QueueEntry {
  invoice: Invoice;
  amount: string;
}

type BundleItemStatus = "pending" | "paid" | "failed";

interface Props {
  queue: QueueEntry[];
  onAmountChange: (invoiceId: string, value: string) => void;
  onRemove: (invoiceId: string) => void;
  onReorder?: (newQueue: QueueEntry[]) => void;
  bundleId?: string;
  bundleStatus?: "draft" | "collecting" | "completed" | "partial" | "failed";
  itemStatuses?: Record<string, BundleItemStatus>;
}

const BUNDLE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-800 text-gray-400",
  collecting: "bg-indigo-900/40 text-indigo-300",
  completed: "bg-green-900/40 text-green-300",
  partial: "bg-yellow-900/40 text-yellow-300",
  failed: "bg-red-900/40 text-red-300",
};

const ITEM_STATUS_STYLES: Record<BundleItemStatus, string> = {
  pending: "bg-gray-800 text-gray-400",
  paid: "bg-green-900/40 text-green-300",
  failed: "bg-red-900/40 text-red-300",
};

export default function BatchPayQueue({
  queue,
  onAmountChange,
  onRemove,
  onReorder,
  bundleId,
  bundleStatus,
  itemStatuses,
}: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const runningTotal = queue.reduce((sum, entry) => {
    const parsed = parseFloat(entry.amount);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

  const completedCount = itemStatuses
    ? queue.filter((entry) => itemStatuses[entry.invoice.id] === "paid").length
    : 0;
  const completionPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 0;
  const isBundle = Boolean(bundleId);

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newQueue = [...queue];
    const [dragged] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(targetIndex, 0, dragged);
    onReorder?.(newQueue);
    setDraggedIndex(null);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.altKey && e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      const newQueue = [...queue];
      [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
      onReorder?.(newQueue);
    } else if (e.altKey && e.key === "ArrowDown" && index < queue.length - 1) {
      e.preventDefault();
      const newQueue = [...queue];
      [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
      onReorder?.(newQueue);
    }
  };

  if (queue.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        Search for invoices above to add them to the payment queue.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isBundle && (
        <div className="flex flex-col gap-2 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">Bundle #{bundleId}</span>
            {bundleStatus && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  BUNDLE_STATUS_STYLES[bundleStatus] ?? BUNDLE_STATUS_STYLES.draft
                }`}
              >
                {bundleStatus}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {completedCount} of {queue.length} paid
            </span>
            <span>{completionPercent}% complete</span>
          </div>
          <div
            className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Bundle completion progress"
          >
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      )}
      {queue.map(({ invoice, amount }, index) => {
        const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
        const itemStatus = itemStatuses?.[invoice.id];
        return (
          <div
            key={invoice.id}
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => setDraggedIndex(null)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            tabIndex={0}
            className={`bg-gray-900 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 cursor-grab ${
              draggedIndex === index ? "opacity-50" : ""
            }`}
          >
            <span className="text-gray-500 text-xs select-none">⋮⋮</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">Invoice #{invoice.id}</p>
                {itemStatus && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${ITEM_STATUS_STYLES[itemStatus]}`}
                  >
                    {itemStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Total: {formatAmount(total)} USDC · Status: {invoice.status}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor={`amount-${invoice.id}`} className="sr-only">
                Amount for invoice #{invoice.id}
              </label>
              <input
                id={`amount-${invoice.id}`}
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="Amount (USDC)"
                value={amount}
                onChange={(e) => onAmountChange(invoice.id, e.target.value)}
                className="w-36 min-h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => onRemove(invoice.id)}
                aria-label={`Remove invoice #${invoice.id}`}
                className="min-h-9 min-w-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between px-1 pt-1 border-t border-gray-800">
        <span className="text-sm text-gray-400">
          {isBundle ? "Bundle total" : "Running total"}
        </span>
        <span className="text-sm font-semibold text-indigo-300">
          {runningTotal.toFixed(7).replace(/\.?0+$/, "")} USDC
        </span>
      </div>
    </div>
  );
}
