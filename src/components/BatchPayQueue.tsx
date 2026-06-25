"use client";

import { formatAmount, parseAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import { useState } from "react";

interface QueueEntry {
  invoice: Invoice;
  amount: string;
}

interface Props {
  queue: QueueEntry[];
  onAmountChange: (invoiceId: string, value: string) => void;
  onRemove: (invoiceId: string) => void;
  onReorder?: (newQueue: QueueEntry[]) => void;
}

export default function BatchPayQueue({ queue, onAmountChange, onRemove, onReorder }: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const runningTotal = queue.reduce((sum, entry) => {
    const parsed = parseFloat(entry.amount);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

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
      {queue.map(({ invoice, amount }, index) => {
        const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
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
              <p className="text-sm font-semibold truncate">Invoice #{invoice.id}</p>
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
        <span className="text-sm text-gray-400">Running total</span>
        <span className="text-sm font-semibold text-indigo-300">
          {runningTotal.toFixed(7).replace(/\.?0+$/, "")} USDC
        </span>
      </div>
    </div>
  );
}
