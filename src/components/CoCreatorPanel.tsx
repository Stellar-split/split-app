"use client";

import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

type InvoiceWithCoCreators = Invoice & { coCreators?: string[] };

interface Props {
  invoice: InvoiceWithCoCreators;
  publicKey: string;
  onUpdate: () => Promise<void>;
}

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export default function CoCreatorPanel({ invoice, publicKey, onUpdate }: Props) {
  const [newAddress, setNewAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isCreator = publicKey === invoice.creator;

  if (!isCreator) {
    return null;
  }

  const handleAddCoCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newAddress.trim()) {
      setError("Please enter an address");
      return;
    }

    if (!isValidStellarAddress(newAddress)) {
      setError("Invalid Stellar address format");
      return;
    }

    setLoading(true);
    try {
      await (splitClient as any).addCoCreator(invoice.id, newAddress);
      setSuccess(`Added ${truncateAddress(newAddress)} as co-creator`);
      setNewAddress("");
      await onUpdate();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoCreator = async (address: string) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await (splitClient as any).removeCoCreator(invoice.id, address);
      setSuccess(`Removed ${truncateAddress(address)} as co-creator`);
      await onUpdate();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-8 border border-gray-700 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Co-Creators</h2>

      {/* Current co-creators */}
      {invoice.coCreators && invoice.coCreators.length > 0 ? (
        <ul className="flex flex-col gap-2 mb-4">
          {invoice.coCreators.map((address: string) => (
            <li
              key={address}
              className="flex items-center justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm"
            >
              <span className="font-mono text-gray-300 truncate" title={address}>
                {address}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCoCreator(address)}
                disabled={loading}
                className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 mb-4">No co-creators yet.</p>
      )}

      {/* Add co-creator form */}
      <form onSubmit={handleAddCoCreator} className="flex flex-col gap-3">
        <div>
          <label htmlFor="co-creator-address" className="block text-sm font-medium text-gray-300 mb-1">
            Add Co-Creator
          </label>
          <input
            id="co-creator-address"
            type="text"
            placeholder="Stellar address (G...)"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            disabled={loading}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add Co-Creator"}
        </button>
      </form>
    </section>
  );
}
