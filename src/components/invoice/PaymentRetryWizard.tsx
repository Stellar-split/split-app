"use client";

import { useCallback, useState } from "react";
import FocusTrap from "@/components/FocusTrap";
import { parseStellarError, type ParsedStellarError } from "@/lib/stellarErrorParser";

interface PaymentRetryWizardProps {
  open: boolean;
  error: any;
  invoiceId: string;
  retryAttempt: number;
  onRetry: (feeMultiplier?: number) => Promise<void>;
  onRefreshSequence: () => Promise<void>;
  onClose: () => void;
}

const MAX_RETRY_ATTEMPTS = 3;

export default function PaymentRetryWizard({
  open,
  error,
  invoiceId,
  retryAttempt,
  onRetry,
  onRefreshSequence,
  onClose,
}: PaymentRetryWizardProps) {
  const [step, setStep] = useState<"explanation" | "action" | "complete">("explanation");
  const [loading, setLoading] = useState(false);
  const [feeMultiplier, setFeeMultiplier] = useState(1.5);
  const [actionError, setActionError] = useState<string | null>(null);

  const parsedError: ParsedStellarError = parseStellarError(
    error?.message || error?.code || String(error),
    error
  );

  const isMaxRetriesReached = retryAttempt >= MAX_RETRY_ATTEMPTS;

  const handleBumpFeeRetry = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      await onRetry(feeMultiplier);
      setStep("complete");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [feeMultiplier, onRetry]);

  const handleRefreshSequence = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      await onRefreshSequence();
      setStep("complete");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [onRefreshSequence]);

  const handleRetry = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      await onRetry();
      setStep("complete");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [onRetry]);

  if (!open) return null;

  return (
    <FocusTrap onClose={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="retry-wizard-title"
      >
        <div className="bg-gray-900 rounded-lg shadow-2xl max-w-md w-full border border-gray-700">
          <div className="p-6">
            {step === "explanation" && (
              <>
                <h2
                  id="retry-wizard-title"
                  className="text-xl font-bold text-white mb-2"
                >
                  {parsedError.title}
                </h2>
                <p className="text-gray-400 mb-4">{parsedError.explanation}</p>

                {isMaxRetriesReached && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                    You have reached the maximum number of retry attempts ({MAX_RETRY_ATTEMPTS}).
                    Please contact support if the issue persists.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep("action")}
                    disabled={isMaxRetriesReached}
                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Try Fix
                  </button>
                </div>
              </>
            )}

            {step === "action" && (
              <>
                <h2 className="text-xl font-bold text-white mb-3">
                  {parsedError.actionType === "bump-fee" && "Increase Transaction Fee"}
                  {parsedError.actionType === "refresh-seq" && "Refresh Sequence Number"}
                  {parsedError.actionType === "fund-destination" && "Fund Destination Account"}
                  {parsedError.actionType === "manual" && "Resolve Issue"}
                </h2>

                <p className="text-gray-400 mb-4">{parsedError.suggestedAction}</p>

                {actionError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                    {actionError}
                  </div>
                )}

                {parsedError.actionType === "bump-fee" && (
                  <div className="mb-4">
                    <label className="block text-sm text-gray-300 mb-2">
                      Fee Multiplier: {feeMultiplier.toFixed(1)}x
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.1"
                      value={feeMultiplier}
                      onChange={(e) => setFeeMultiplier(parseFloat(e.target.value))}
                      className="w-full"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Higher multiplier = faster confirmation but higher cost
                    </p>
                  </div>
                )}

                {parsedError.actionType === "fund-destination" && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm">
                    <p>
                      On testnet: Use{" "}
                      <a
                        href="https://developers.stellar.org/docs/networks/testnet-reset/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Friendbot
                      </a>{" "}
                      to fund the destination.
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("explanation")}
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Back
                  </button>
                  {parsedError.actionType === "bump-fee" && (
                    <button
                      onClick={handleBumpFeeRetry}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Retrying..." : "Retry with Higher Fee"}
                    </button>
                  )}
                  {parsedError.actionType === "refresh-seq" && (
                    <button
                      onClick={handleRefreshSequence}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Refreshing..." : "Refresh & Retry"}
                    </button>
                  )}
                  {(parsedError.actionType === "fund-destination" ||
                    parsedError.actionType === "manual") && (
                    <button
                      onClick={handleRetry}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </div>
              </>
            )}

            {step === "complete" && (
              <>
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 mb-3">
                    <svg
                      className="w-6 h-6 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white">Retry Submitted</h2>
                  <p className="text-gray-400 text-sm mt-2">
                    Your transaction has been resubmitted. It should process shortly.
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
