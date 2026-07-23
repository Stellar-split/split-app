"use client";

import { useState } from "react";
import FocusTrap from "./FocusTrap";

interface Props {
  invoiceId: string;
  onConfirm: (deadlineIso: string) => void;
  onClose: () => void;
}

/** Validate that the chosen deadline is at least 1 hour from now. */
export function validateDeadline(isoString: string): string | null {
  const chosen = new Date(isoString).getTime();
  const minAllowed = Date.now() + 60 * 60 * 1000; // now + 1h
  if (isNaN(chosen)) return "Please enter a valid date.";
  if (chosen < minAllowed) return "Deadline must be at least 1 hour in the future";
  return null;
}

/** Default deadline: now + 7 days, truncated to the minute for datetime-local. */
function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function DuplicateModal({ invoiceId, onConfirm, onClose }: Props) {
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    const err = validateDeadline(deadline);
    if (err) {
      setValidationError(err);
      return;
    }
    onConfirm(deadline);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="duplicate-modal-title" className="text-lg font-semibold text-indigo-400">
              Duplicate Invoice #{invoiceId}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Choose a new deadline for the duplicated invoice. All other fields will be pre-filled from the original.
          </p>

          <div className="mb-4">
            <label
              htmlFor="dup-deadline"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              New Deadline
            </label>
            <input
              id="dup-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                setValidationError(null);
              }}
              className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-describedby={validationError ? "dup-deadline-error" : undefined}
              aria-invalid={!!validationError}
            />
            {validationError && (
              <p
                id="dup-deadline-error"
                role="alert"
                className="text-red-400 text-xs mt-1"
              >
                {validationError}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Confirm & Continue
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
