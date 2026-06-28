"use client";

import { useState } from "react";
import { generateExport, downloadExport } from "@/lib/accountDataExport";
import type { AccountDataExport } from "@/lib/accountDataExport";

export default function DataExportPage() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDone(false);

    try {
      const address = typeof window !== "undefined"
        ? localStorage.getItem("stellarsplit_wallet_address") ?? "unknown"
        : "unknown";

      const data: AccountDataExport = await generateExport(address, setProgress);
      downloadExport(data);
      setDone(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Data Export</h1>
      <p className="text-sm text-gray-400 mb-8">
        Download a human-readable JSON file containing all your locally-stored
        app data and on-chain invoice history. No private keys or secrets are
        included.
      </p>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {exporting ? "Exporting…" : "Export My Data"}
      </button>

      {progress && (
        <p className="mt-4 text-sm text-gray-300">{progress}</p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      {done && (
        <p className="mt-4 text-sm text-green-400">
          Export complete — check your downloads.
        </p>
      )}
    </main>
  );
}
