"use client";

import { useState } from "react";
import { searchArbitrators, getArbitrators } from "@/lib/arbitrators";
import type { Arbitrator } from "@/lib/arbitrators";

const DISPUTE_REASONS = [
  "Non-delivery",
  "Wrong amount",
  "Fraud",
  "Other",
];

interface Props {
  invoiceId: string;
  onSubmit: (reason: string, description: string, arbitratorAddress?: string) => Promise<void>;
  onClose: () => void;
}

export default function DisputeWizard({ invoiceId, onSubmit, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [selectedArbitrator, setSelectedArbitrator] = useState<string>("");
  const [arbitratorSearch, setArbitratorSearch] = useState("");
  const [manualArbitrator, setManualArbitrator] = useState("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registryEmpty = getArbitrators().length === 0;
  const arbitratorResults = searchArbitrators(arbitratorSearch);
  const effectiveArbitrator = useManualEntry || registryEmpty ? manualArbitrator : selectedArbitrator;

  const isStep2Valid = reason.length > 0;
  const isStep3Valid = description.length >= 20;

  const handleNext = () => {
    if (step === 1 && isStep2Valid) setStep(2);
    else if (step === 2 && isStep3Valid) setStep(3);
    else if (step === 3) setStep(4);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(reason, description, effectiveArbitrator || undefined);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">File Dispute</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Step 1: Reason Selection */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Step 1 of 4: Select reason</p>
            {DISPUTE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`w-full p-3 rounded-lg border-2 transition-colors text-left text-sm ${
                  reason === r
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Description */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Step 2 of 4: Describe the issue</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Minimum 20 characters..."
              maxLength={500}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-32"
            />
            <p className="text-xs text-gray-500">
              {description.length}/500 characters
            </p>
          </div>
        )}

        {/* Step 3: Arbitrator Selection */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Step 3 of 4: Select arbitrator (optional)</p>

            {registryEmpty ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">No arbitrators registered yet.</p>
                <input
                  type="text"
                  value={manualArbitrator}
                  onChange={(e) => setManualArbitrator(e.target.value)}
                  placeholder="Enter arbitrator address (G...)"
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            ) : (
              <>
                {!useManualEntry && (
                  <>
                    <input
                      type="text"
                      value={arbitratorSearch}
                      onChange={(e) => setArbitratorSearch(e.target.value)}
                      placeholder="Search arbitrators…"
                      className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {arbitratorResults.map((arb: Arbitrator) => (
                        <button
                          key={arb.address}
                          type="button"
                          onClick={() => setSelectedArbitrator(arb.address)}
                          className={`w-full p-3 rounded-lg border-2 transition-colors text-left text-sm ${
                            selectedArbitrator === arb.address
                              ? "border-indigo-500 bg-indigo-500/10"
                              : "border-gray-700 bg-gray-800 hover:border-gray-600"
                          }`}
                        >
                          <span className="font-medium">{arb.name}</span>
                          <span className="block text-xs text-gray-400 font-mono truncate">
                            {arb.address}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {arb.resolvedDisputeCount !== null
                              ? `${arb.resolvedDisputeCount} resolved`
                              : "No history yet"}
                          </span>
                        </button>
                      ))}
                      {arbitratorResults.length === 0 && (
                        <p className="text-sm text-gray-500 py-2">No results.</p>
                      )}
                    </div>
                  </>
                )}

                {useManualEntry && (
                  <input
                    type="text"
                    value={manualArbitrator}
                    onChange={(e) => setManualArbitrator(e.target.value)}
                    placeholder="Enter arbitrator address (G...)"
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                )}

                <button
                  type="button"
                  onClick={() => setUseManualEntry(!useManualEntry)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {useManualEntry ? "Pick from registry" : "Enter address manually"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Step 4 of 4: Confirm dispute</p>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Reason</p>
                <p className="text-sm font-medium">{reason}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-300 break-words">{description}</p>
              </div>
              {effectiveArbitrator && (
                <div>
                  <p className="text-xs text-gray-500">Arbitrator</p>
                  <p className="text-sm text-gray-300 font-mono break-all">{effectiveArbitrator}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 ? !isStep2Valid : step === 2 ? !isStep3Valid : false}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Filing…" : "File Dispute"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
