"use client";

import { useState } from "react";

interface RecurringConfig {
  enabled: boolean;
  intervalDays: 7 | 30;
  endDate?: string;
  maxOccurrences?: number;
}

interface Props {
  onConfirm: (config: RecurringConfig) => void;
}

export default function RecurringWizard({ onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [intervalDays, setIntervalDays] = useState<7 | 30>(7);
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [useMaxOccurrences, setUseMaxOccurrences] = useState(false);

  const generatePreviewDates = () => {
    const dates = [];
    let current = new Date();
    const limit = useMaxOccurrences ? parseInt(maxOccurrences) : 12;

    for (let i = 0; i < limit; i++) {
      current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      if (endDate && current > new Date(endDate)) break;
      dates.push(current.toISOString().split("T")[0]);
    }
    return dates;
  };

  const previewDates = step === 3 ? generatePreviewDates() : [];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = () => {
    onConfirm({
      enabled: true,
      intervalDays,
      ...(useMaxOccurrences && { maxOccurrences: parseInt(maxOccurrences) }),
      ...(!useMaxOccurrences && endDate && { endDate }),
    });
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-6">Recurring Invoice Setup</h3>

      {/* Step 1: Interval Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 1 of 3: Select interval</p>
          <div className="space-y-3">
            {[
              { value: 7, label: "Weekly" },
              { value: 30, label: "Monthly" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIntervalDays(option.value as 7 | 30)}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  intervalDays === option.value
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-gray-400 ml-2">({option.value} days)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: End Date / Max Occurrences */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 2 of 3: Set duration</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={!useMaxOccurrences}
                onChange={() => setUseMaxOccurrences(false)}
                className="w-4 h-4"
              />
              <span className="text-sm">End date</span>
            </label>
            {!useMaxOccurrences && (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={useMaxOccurrences}
                onChange={() => setUseMaxOccurrences(true)}
                className="w-4 h-4"
              />
              <span className="text-sm">Max occurrences</span>
            </label>
            {useMaxOccurrences && (
              <input
                type="number"
                min="1"
                max="52"
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
                placeholder="Number of invoices"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Step 3 of 3: Review schedule</p>
          <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-3">
              Planned invoice dates ({previewDates.length} total):
            </p>
            <ul className="space-y-2">
              {previewDates.map((date, i) => (
                <li key={i} className="text-sm text-gray-300">
                  {new Date(date).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
