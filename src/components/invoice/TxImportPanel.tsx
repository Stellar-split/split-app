"use client";

import { useState } from "react";
import type { ImportedTxData } from "@/lib/txImport";

interface Props {
  onImported: (data: ImportedTxData) => void;
}

const HASH_RE = /^[0-9a-fA-F]{64}$/;

/**
 * TxImportPanel — paste a Stellar transaction hash to pre-fill an invoice
 * form from an on-chain transaction that already happened.
 */
export default function TxImportPanel({ onImported }: Props) {
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedTxData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hash.trim();
    if (!trimmed) return;

    if (!HASH_RE.test(trimmed)) {
      setError("Enter a valid 64-character transaction hash.");
      return;
    }

    setLoading(true);
    setError(null);
    setImported(null);

    try {
      const res = await fetch(`/api/invoices/import-tx?hash=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to import transaction.");
      }
      setImported(data as ImportedTxData);
      onImported(data as ImportedTxData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-400">
        Paste the hash of a Stellar transaction that already happened outside StellarSplit.
        We&apos;ll fetch it and pre-fill the invoice below, marked as retroactive and fully paid.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          placeholder="Transaction hash (64 hex characters)"
          aria-label="Transaction hash"
          className="flex-1 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !hash.trim()}
          className="min-h-11 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {imported && imported.ignoredOperations.length > 0 && (
        <div
          role="status"
          className="text-yellow-300 text-sm bg-yellow-950/40 border border-yellow-800 rounded-lg px-3 py-2"
        >
          Ignored {imported.ignoredOperations.reduce((s, o) => s + o.count, 0)} non-payment operation
          {imported.ignoredOperations.reduce((s, o) => s + o.count, 0) === 1 ? "" : "s"}:{" "}
          {imported.ignoredOperations.map((o) => `${o.count}× ${o.type}`).join(", ")}
        </div>
      )}

      {imported && (
        <div className="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700">
          <div className="px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-700">
            Imported from transaction
          </div>
          {imported.recipients.map((r, i) => (
            <div key={i} className="px-4 py-2 flex justify-between items-center gap-2 text-sm">
              <span className="font-mono text-gray-300 truncate">{r.address}</span>
              <span className="text-indigo-300 shrink-0">
                {r.amount} {r.asset}
              </span>
            </div>
          ))}
          {imported.memo && (
            <div className="px-4 py-2 text-sm text-gray-400">Memo: {imported.memo}</div>
          )}
        </div>
      )}
    </div>
  );
}
