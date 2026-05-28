"use client";

import { useState } from "react";

const DISPUTE_REASONS = [
  "Non-delivery",
  "Wrong amount",
  "Fraud",
  "Other",
];

interface Props {
  invoiceId: string;
  onSubmit: (reason: string, description: string) => Promise<void>;
  onClose: () => void;
}

export default function DisputeWizard({ invoiceId, onSubmit, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStep2Valid = reason.length > 0;
  const isStep3Valid = description.length >= 20;

  const handleNext = () => {
    if (step === 1 && isStep2Valid) setStep(2);
    else if (step === 2 && isStep3Valid) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(reason, description);
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
            <p className="text-sm text-gray-400">Step 1 of 3: Select reason</p>
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
            <p className="text-sm text-gray-400">Step 2 of 3: Describe the issue</p>
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

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Step 3 of 3: Confirm dispute</p>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Reason</p>
                <p className="text-sm font-medium">{reason}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-300 break-words">{description}</p>
              </div>
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
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 ? !isStep2Valid : !isStep3Valid}
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
