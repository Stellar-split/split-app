"use client";

import { useState } from "react";
import FocusTrap from "./FocusTrap";
import { splitClient } from "@/lib/stellar";
import { parseAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoices: Invoice[];
  publicKey: string;
  onClose: () => void;
}

/**
 * BatchPayModal — shows an amount input per selected invoice and calls
 * splitClient.batchPay() with all (invoiceId, amount) pairs on confirm.
 */
export default function BatchPayModal({ invoices, publicKey, onClose }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(invoices.map((inv) => [inv.id, ""]))
  );
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setPaying(true);
    try {
      const pairs = invoices
        .filter((inv) => amounts[inv.id] && parseFloat(amounts[inv.id]) > 0)
        .map((inv) => ({ invoiceId: inv.id, amount: parseAmount(amounts[inv.id]) }));

      if (pairs.length === 0) {
        setError("Enter an amount for at least one invoice.");
        setPaying(false);
        return;
      }

      // SDK doesn't expose batchPay yet — execute pays sequentially and
      // surface the last tx hash as the batch result.
      let lastTxHash = "";
      for (const pair of pairs) {
        const result = await splitClient.pay({ payer: publicKey, invoiceId: pair.invoiceId, amount: pair.amount });
        lastTxHash = result.txHash;
      }
      setTxHash(lastTxHash);
    } catch (err) {
      setError(String(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-pay-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    >
      <FocusTrap onClose={onClose}>
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 id="batch-pay-title" className="text-xl font-bold">
            Batch Pay
          </h2>
          <button
            onClick={onClose}
            aria-label="Close batch pay modal"
            className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-400">
          Enter the amount you want to pay toward each invoice.
        </p>

        <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3">
              <span className="text-sm text-gray-300 w-24 shrink-0">
                Invoice #{inv.id}
              </span>
              <label htmlFor={`batch-amount-${inv.id}`} className="sr-only">
                Amount for Invoice #{inv.id} in USDC
              </label>
              <input
                id={`batch-amount-${inv.id}`}
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="USDC amount"
                value={amounts[inv.id]}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [inv.id]: e.target.value }))
                }
                className="flex-1 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-w-0"
              />
            </li>
          ))}
        </ul>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {txHash ? (
          <div className="flex flex-col gap-3">
            <p className="text-green-400 text-sm">
              Batch payment sent! Tx: {txHash.slice(0, 16)}…
            </p>
            <button
              onClick={onClose}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={paying}
              className="flex-1 min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {paying ? "Sending…" : "Confirm Payment"}
            </button>
          </div>
        )}
      </FocusTrap>
      </div>
    </div>
  );
}
