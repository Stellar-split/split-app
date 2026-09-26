"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FocusTrap from "./FocusTrap";
import type { Payment } from "@stellar-split/sdk";

export interface CancelModalProps {
  invoiceId: string;
  invoiceTitle?: string;
  payments?: Payment[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onSuccess?: () => void;
}

export type CancelModalStep = "warn" | "confirm_gate" | "loading" | "success";

/**
 * Multi-step invoice cancellation confirmation modal.
 * Step 1: "Are you sure?" with consequences explained (zero refunds needed).
 * Step 2: Type invoice title destructive action gate.
 * Step 3: Loading state while SDK call processes.
 * Step 4: Success state with "Invoice Cancelled" and redirect to dashboard.
 */
export default function CancelModal({
  invoiceId,
  invoiceTitle,
  payments = [],
  onConfirm,
  onClose,
  onSuccess,
}: CancelModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<CancelModalStep>("warn");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedTitle = (invoiceTitle || `Invoice #${invoiceId}`).trim();
  const isMatch = confirmText.trim().toLowerCase() === expectedTitle.toLowerCase();

  const handleStartCancellation = async () => {
    setStep("loading");
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      setLoading(false);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === "success") {
      const timer = setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/dashboard");
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, onSuccess, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      onClick={step === "loading" ? undefined : onClose}
    >
      <FocusTrap onClose={step === "loading" ? () => {} : onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 id="cancel-modal-title" className="text-lg font-semibold text-red-400">
              {step === "success" ? "Invoice Cancelled" : `Cancel Invoice #${invoiceId}`}
            </h2>
            {step !== "loading" && step !== "success" && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>

          {/* Step 1: Warning & Consequences */}
          {step === "warn" && (
            <div data-testid="step-warn">
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-sm text-red-200 mb-4">
                <p className="font-semibold mb-1">Are you sure you want to cancel this invoice?</p>
                <p className="text-xs text-red-300">
                  This action is permanent and cannot be undone.
                </p>
              </div>

              <div className="space-y-2 mb-6 text-xs text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">✓</span>
                  <span><strong>Zero payments received:</strong> No refunds are needed because no funds have been deposited.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span>
                  <span><strong>Payment link deactivated:</strong> Payers will no longer be able to submit contributions.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">!</span>
                  <span><strong>Permanent cancellation:</strong> This invoice cannot be reopened once cancelled.</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Keep Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setStep("confirm_gate")}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Destructive Action Gate */}
          {step === "confirm_gate" && (
            <div data-testid="step-confirm-gate">
              <p className="text-sm text-gray-300 mb-3">
                To confirm cancellation, please type the invoice title below:
              </p>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 mb-3 font-mono text-xs text-red-300 select-all break-all">
                {expectedTitle}
              </div>

              <div className="mb-6">
                <label htmlFor="confirm-title-input" className="block text-xs text-gray-400 mb-1">
                  Type title to confirm:
                </label>
                <input
                  id="confirm-title-input"
                  type="text"
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expectedTitle}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("warn")}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!isMatch}
                  onClick={handleStartCancellation}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Loading State */}
          {step === "loading" && (
            <div data-testid="step-loading" className="py-6 flex flex-col items-center justify-center text-center">
              {loading ? (
                <>
                  <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-medium text-white mb-1">Cancelling invoice on-chain...</p>
                  <p className="text-xs text-gray-400">Please confirm any transaction in your wallet if prompted.</p>
                </>
              ) : error ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 text-lg mb-3">
                    ✕
                  </div>
                  <p className="text-sm font-semibold text-red-400 mb-2">Cancellation Failed</p>
                  <p className="text-xs text-gray-300 mb-4 max-w-xs">{error}</p>
                  <div className="flex gap-3 w-full">
                    <button
                      type="button"
                      onClick={() => setStep("confirm_gate")}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold text-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStartCancellation}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Step 4: Success State */}
          {step === "success" && (
            <div data-testid="step-success" className="py-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-900/50 border border-green-600/60 flex items-center justify-center text-green-400 text-2xl mb-3">
                ✓
              </div>
              <h3 className="text-base font-bold text-white mb-1">Invoice Cancelled</h3>
              <p className="text-xs text-gray-400 mb-6">
                Invoice #{invoiceId} has been successfully cancelled. Redirecting to dashboard...
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onSuccess) onSuccess();
                  else router.push("/dashboard");
                }}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}
