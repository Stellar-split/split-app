"use client";

import { useEffect, useRef, useState } from "react";
import { getFreighterPublicKey } from "@/lib/freighter";
import {
  exportState,
  importState,
  downloadBlob,
  type StateBlob,
} from "@/lib/stateSync";

type Status = { type: "idle" } | { type: "loading" } | { type: "success"; message: string } | { type: "error"; message: string };

export default function StateSyncPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<Status>({ type: "idle" });
  const [importStatus, setImportStatus] = useState<Status>({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFreighterPublicKey().then(setWalletAddress).catch(() => null);
  }, []);

  const handleExport = async () => {
    if (!walletAddress) {
      setExportStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    setExportStatus({ type: "loading" });
    try {
      const blob = await exportState(walletAddress);
      downloadBlob(blob);
      setExportStatus({ type: "success", message: "State exported and downloaded successfully." });
    } catch (err) {
      setExportStatus({ type: "error", message: String(err) });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: "loading" });
    try {
      const text = await file.text();
      const blob: StateBlob = JSON.parse(text);
      const { imported } = await importState(blob);
      setImportStatus({ type: "success", message: `Imported ${imported} key${imported !== 1 ? "s" : ""} successfully.` });
    } catch (err) {
      setImportStatus({ type: "error", message: String(err) });
    } finally {
      // Reset file input so the same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">State Sync</h1>
      <p className="text-gray-400 mb-8">
        Export your app state (templates, address book, preferences) as a signed JSON file and import it on another device.
        Only keys prefixed with <code className="text-indigo-300 text-sm">stellarsplit_</code> are included.
      </p>

      {!walletAddress && (
        <div className="mb-6 p-4 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-300 text-sm">
          Connect your Freighter wallet to sign exports and verify imports.
        </div>
      )}

      {/* Export */}
      <section aria-labelledby="export-heading" className="bg-gray-900 rounded-xl p-5 mb-6">
        <h2 id="export-heading" className="text-lg font-semibold mb-1">Export State</h2>
        <p className="text-sm text-gray-400 mb-4">
          Serialises all <code className="text-indigo-300">stellarsplit_</code> localStorage keys to a signed JSON file you can download.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportStatus.type === "loading"}
          className="min-h-11 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {exportStatus.type === "loading" ? "Exporting…" : "Export State"}
        </button>
        {exportStatus.type === "success" && (
          <p role="status" className="mt-3 text-green-400 text-sm">{exportStatus.message}</p>
        )}
        {exportStatus.type === "error" && (
          <p role="alert" className="mt-3 text-red-400 text-sm">{exportStatus.message}</p>
        )}
      </section>

      {/* Import */}
      <section aria-labelledby="import-heading" className="bg-gray-900 rounded-xl p-5">
        <h2 id="import-heading" className="text-lg font-semibold mb-1">Import State</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select a previously exported JSON file. The signature will be verified before any data is written.
          Imported values overwrite existing ones for matching keys.
        </p>
        <label className="block">
          <span className="sr-only">Choose state file to import</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            disabled={importStatus.type === "loading"}
            className="block w-full text-sm text-gray-300
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-600 file:text-white
              hover:file:bg-indigo-500
              file:cursor-pointer file:min-h-11
              disabled:opacity-50"
          />
        </label>
        {importStatus.type === "loading" && (
          <p role="status" className="mt-3 text-gray-400 text-sm">Verifying and importing…</p>
        )}
        {importStatus.type === "success" && (
          <p role="status" className="mt-3 text-green-400 text-sm">{importStatus.message}</p>
        )}
        {importStatus.type === "error" && (
          <p role="alert" className="mt-3 text-red-400 text-sm">{importStatus.message}</p>
        )}
      </section>
    </main>
  );
}
