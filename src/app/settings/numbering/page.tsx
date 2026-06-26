"use client";

import { useEffect, useState } from "react";
import {
  getNumberingSettings,
  saveNumberingSettings,
  applyPattern,
} from "@/lib/invoiceNumbering";

const TOKENS = ["{YYYY}", "{MM}", "{seq}"];
const EXAMPLE_ASSIGNMENT = { seq: 1, year: "2026", month: "06" };

export default function NumberingSettingsPage() {
  const [pattern, setPattern] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const settings = getNumberingSettings();
    setPattern(settings.pattern);
  }, []);

  const preview = pattern
    ? applyPattern(pattern, EXAMPLE_ASSIGNMENT)
    : "No pattern set";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveNumberingSettings({ pattern: pattern.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setPattern("");
    saveNumberingSettings({ pattern: "" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16">
      <h1 className="text-2xl font-bold mb-2">Invoice Numbering</h1>
      <p className="text-sm text-gray-400 mb-8">
        Define a display-only numbering pattern. The real on-chain invoice ID is
        never changed. Leave blank to disable custom numbering.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div>
          <label htmlFor="pattern" className="block text-sm font-medium text-gray-300 mb-1">
            Pattern
          </label>
          <input
            id="pattern"
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. INV-{YYYY}-{seq}"
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            Available tokens:{" "}
            {TOKENS.map((t) => (
              <code key={t} className="bg-gray-700 px-1 rounded mr-1">{t}</code>
            ))}
          </p>
        </div>

        <div className="rounded-lg bg-gray-800 border border-gray-700 p-4">
          <p className="text-xs text-gray-400 mb-1">Preview</p>
          <p className="text-sm font-mono text-indigo-300">{preview}</p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="min-h-11 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            Clear
          </button>
        </div>

        {saved && (
          <p className="text-sm text-green-400" role="status">
            Saved successfully.
          </p>
        )}
      </form>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">How it works</h2>
        <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
          <li>The display number appears alongside the real invoice ID on cards and the detail page.</li>
          <li>Each invoice gets a sequence number the first time it is viewed — this never changes.</li>
          <li>Changing the pattern does not renumber invoices you have already seen.</li>
        </ul>
      </section>
    </main>
  );
}
