"use client";

import React, { useState } from "react";

export interface CoSignerSectionProps {
  cosigners: string[];
  threshold: number;
  onChange: (cosigners: string[], threshold: number) => void;
  className?: string;
}

export default function CoSignerSection({
  cosigners,
  threshold,
  onChange,
  className = "",
}: CoSignerSectionProps) {
  const [enabled, setEnabled] = useState(cosigners.length > 0);
  const [newAddress, setNewAddress] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange([], 1);
    } else if (cosigners.length === 0) {
      onChange([], 1);
    }
  };

  const handleAddCoSigner = () => {
    const trimmed = newAddress.trim();
    if (!trimmed) {
      setInputError("Address cannot be empty");
      return;
    }
    if (trimmed.length !== 56 || !trimmed.startsWith("G")) {
      setInputError("Invalid Stellar public key (must start with G and be 56 characters)");
      return;
    }
    if (cosigners.includes(trimmed)) {
      setInputError("Co-signer already added");
      return;
    }

    const updated = [...cosigners, trimmed];
    const newThreshold = Math.min(Math.max(threshold, 1), updated.length);
    onChange(updated, newThreshold);
    setNewAddress("");
    setInputError(null);
  };

  const handleRemoveCoSigner = (index: number) => {
    const updated = cosigners.filter((_, i) => i !== index);
    const newThreshold = Math.min(threshold, Math.max(1, updated.length));
    onChange(updated, newThreshold);
  };

  const handleThresholdChange = (val: number) => {
    const clamped = Math.min(Math.max(1, val), Math.max(1, cosigners.length));
    onChange(cosigners, clamped);
  };

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Co-Signer Approvals (N-of-M)</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Require approvals from authorized co-signers before funds can be released.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
            aria-label="Enable co-signer approvals"
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 border-t border-gray-800">
          {/* Add Co-Signer Input */}
          <div>
            <label htmlFor="cosigner-address-input" className="block text-xs font-medium text-gray-300 mb-1">
              Add Co-Signer Stellar Address
            </label>
            <div className="flex gap-2">
              <input
                id="cosigner-address-input"
                type="text"
                value={newAddress}
                onChange={(e) => {
                  setNewAddress(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCoSigner();
                  }
                }}
                placeholder="G..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCoSigner}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                + Add
              </button>
            </div>
            {inputError && <p className="text-xs text-red-400 mt-1">{inputError}</p>}
          </div>

          {/* Co-Signer List */}
          {cosigners.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400">
                Co-Signers ({cosigners.length})
              </p>
              <ul className="space-y-1.5">
                {cosigners.map((addr, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-gray-200 truncate">
                      {addr}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoSigner(idx)}
                      className="text-red-400 hover:text-red-300 p-1 text-sm font-bold shrink-0 transition-colors"
                      aria-label={`Remove co-signer ${addr}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>

              {/* Threshold Selector */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-800/40 border border-gray-800 rounded-lg p-3">
                <div>
                  <label htmlFor="cosigner-threshold-select" className="block text-xs font-semibold text-white">
                    Approval Threshold
                  </label>
                  <p className="text-xs text-gray-400">
                    Require {threshold} of {cosigners.length} approvals to release invoice
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    id="cosigner-threshold-select"
                    value={threshold}
                    onChange={(e) => handleThresholdChange(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: cosigners.length }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} of {cosigners.length} ({Math.round((n / cosigners.length) * 100)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">
              No co-signers added yet. Enter a Stellar address above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
