"use client";

import { useState } from "react";
import FocusTrap from "./FocusTrap";

interface Props {
  invoiceId: string;
  onConfirm: (newOwner: string) => Promise<void>;
  onClose: () => void;
}

export default function TransferOwnershipModal({ invoiceId, onConfirm, onClose }: Props) {
  const [address, setAddress] = useState("");
  const [addressConfirm, setAddressConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = addressConfirm.length > 0 && address !== addressConfirm;
  const canSubmit = address.trim().length > 0 && address === addressConfirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(address.trim());
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
      aria-labelledby="transfer-modal-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="transfer-modal-title" className="text-lg font-semibold text-amber-400">
              Transfer Invoice #{invoiceId}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            Transfer ownership to another address. This action cannot be undone.
            Enter the new owner&apos;s address twice to confirm.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="transfer-address" className="block text-sm font-medium text-gray-300 mb-1">
                New owner address
              </label>
              <input
                id="transfer-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="G…"
                autoFocus
                autoComplete="off"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="transfer-address-confirm" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm new owner address
              </label>
              <input
                id="transfer-address-confirm"
                type="text"
                value={addressConfirm}
                onChange={(e) => setAddressConfirm(e.target.value)}
                placeholder="G…"
                autoComplete="off"
                className={`w-full bg-gray-800 border rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  mismatch ? "border-red-500" : "border-gray-700"
                }`}
              />
              {mismatch && (
                <p className="text-red-400 text-xs mt-1" role="alert">
                  Addresses do not match.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {loading ? "Transferring…" : "Transfer Ownership"}
              </button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
