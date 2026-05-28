"use client";

import { useEffect, useState } from "react";
import FocusTrap from "./FocusTrap";
import { formatAmount } from "@stellar-split/sdk";
import type { Payment } from "@stellar-split/sdk";

interface Props {
  invoiceId: string;
  payments: Payment[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Two-step cancel confirmation modal.
 * Step 1: Preview refund amounts per payer.
 * Step 2: Final confirmation before calling cancelInvoice.
 */
export default function CancelModal({ invoiceId, payments, onConfirm, onClose }: Props) {
  const [step, setStep] = useState<"preview" | "confirm">("preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aggregate payments per payer address
  const refunds = payments.reduce<Record<string, bigint>>((acc, p) => {
    acc[p.payer] = (acc[p.payer] ?? 0n) + p.amount;
    return acc;
  }, {});

  const refundEntries = Object.entries(refunds);

  // Focus trap and Escape handled by FocusTrap

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 id="cancel-modal-title" className="text-lg font-semibold text-red-400">
            Cancel Invoice #{invoiceId}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === "preview" ? (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Cancelling will refund all payers. The following amounts will be returned:
            </p>

            {refundEntries.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No payments to refund.</p>
            ) : (
              <ul className="flex flex-col gap-2 mb-4">
                {refundEntries.map(([payer, amount]) => (
                  <li
                    key={payer}
                    className="flex justify-between bg-gray-800 rounded-lg px-4 py-2 text-sm"
                  >
                    <span
                      className="font-mono text-gray-300 truncate max-w-[60%]"
                      title={payer}
                    >
                      {payer}
                    </span>
                    <span className="text-yellow-300">{formatAmount(amount)} USDC</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Go Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to cancel this invoice? This action cannot be undone.
            </p>

            {error && (
              <p role="alert" className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("preview")}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {loading ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </>
        )}
      </FocusTrap>
      </div>
    </div>
  );
}
