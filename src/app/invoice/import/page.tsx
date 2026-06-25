"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import {
  type RecipientRow,
  type ValidationResult,
  validateRows,
} from "@/lib/bulkImporter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A parsed row that carries the full 4-column invoice shape. */
interface InvoiceRow extends RecipientRow {
  // recipient_address, amount inherited from RecipientRow
  deadline_days: string;
  token: string;
}

// ---------------------------------------------------------------------------
// CSV parser (4-column, header-aware — invoice-specific format)
// The shared bulkImporter.parseCSV handles a different 2-column headerless
// format, so we keep this local parser to avoid coupling.
// ---------------------------------------------------------------------------

function parseInvoiceCSV(text: string): InvoiceRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: InvoiceRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: InvoiceRow = {
      recipient_address: "",
      amount: "",
      deadline_days: "",
      token: "",
    };

    header.forEach((col, idx) => {
      if (col === "recipient_address") row.recipient_address = values[idx] ?? "";
      if (col === "amount") row.amount = values[idx] ?? "";
      if (col === "deadline_days") row.deadline_days = values[idx] ?? "";
      if (col === "token") row.token = values[idx] ?? "";
    });

    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarise(
  parsed: InvoiceRow[],
  results: ValidationResult[],
  excluded: Set<number>
) {
  let valid = 0;
  let invalid = 0;
  let excl = 0;

  parsed.forEach((_, i) => {
    if (excluded.has(i)) {
      excl++;
    } else if (results[i]?.errors.length === 0) {
      valid++;
    } else {
      invalid++;
    }
  });

  return { valid, invalid, excluded: excl };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportInvoicesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<InvoiceRow[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string[] | null>(null);

  // ── File upload ────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;

      setFile(f);
      setError(null);
      setSuccess(null);
      setExcluded(new Set());

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const rows = parseInvoiceCSV(text);
          if (rows.length === 0) {
            setError("No data rows found in CSV (is the header row present?)");
            setParsed([]);
            setResults([]);
            return;
          }
          const validationResults = validateRows(rows);
          setParsed(rows);
          setResults(validationResults);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse CSV");
          setParsed([]);
          setResults([]);
        }
      };
      reader.readAsText(f);
    },
    []
  );

  // ── Checkbox toggle ────────────────────────────────────────────────────────

  const toggleExclude = useCallback((idx: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const includableRows = parsed.filter(
      (_, i) => results[i]?.errors.length === 0 && !excluded.has(i)
    );

    if (includableRows.length === 0) {
      setError("No valid rows to import");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const publicKey = await getFreighterPublicKey();
      const invoiceIds: string[] = [];

      for (const row of includableRows) {
        const inv = await splitClient.createInvoice({
          creator: publicKey,
          recipients: [
            {
              address: row.recipient_address,
              amount: BigInt(Math.floor(Number(row.amount) * 1e7)),
            },
          ],
          deadline:
            Math.floor(Date.now() / 1000) + Number(row.deadline_days) * 86400,
          token: row.token,
        });
        invoiceIds.push(inv.invoiceId);
      }

      setSuccess(invoiceIds);
      setParsed([]);
      setResults([]);
      setExcluded(new Set());
      setFile(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invoices"
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const summary = summarise(parsed, results, excluded);
  const includableValidCount = parsed.filter(
    (_, i) => results[i]?.errors.length === 0 && !excluded.has(i)
  ).length;
  const importDisabled = loading || includableValidCount === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Import Invoices</h1>
        <p className="text-gray-500 text-sm mb-8">
          Upload a CSV file to bulk-create invoices. Review and fix (or exclude)
          any invalid rows before importing.
        </p>

        {/* ── Upload card ── */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-semibold mb-2">
            Upload CSV File
          </label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-2">
            Expected columns:{" "}
            <code className="bg-gray-100 px-1 rounded">recipient_address</code>
            ,{" "}
            <code className="bg-gray-100 px-1 rounded">amount</code>
            ,{" "}
            <code className="bg-gray-100 px-1 rounded">deadline_days</code>
            ,{" "}
            <code className="bg-gray-100 px-1 rounded">token</code>
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm"
          >
            {error}
          </div>
        )}

        {/* ── Success banner ── */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold mb-2">
              Successfully created {success.length} invoice(s):
            </p>
            <ul className="text-sm text-green-700 space-y-1">
              {success.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Preview section ── */}
        {parsed.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Preview ({parsed.length} row{parsed.length !== 1 ? "s" : ""})
              </h2>

              {/* Summary line */}
              <p
                id="import-summary"
                className="text-sm font-medium text-gray-600"
              >
                <span className="text-green-600">{summary.valid} valid</span>
                {", "}
                <span className="text-red-600">{summary.invalid} invalid</span>
                {", "}
                <span className="text-gray-400">
                  {summary.excluded} excluded
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-3 py-2 w-8">
                      <span className="sr-only">Exclude</span>
                    </th>
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">Recipient Address</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Deadline (days)</th>
                    <th className="px-3 py-2">Token</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, idx) => {
                    const rowResult = results[idx];
                    const hasErrors =
                      rowResult && rowResult.errors.length > 0;
                    const isExcluded = excluded.has(idx);

                    let rowBg = "";
                    if (isExcluded) rowBg = "bg-gray-100";
                    else if (hasErrors) rowBg = "bg-red-50";

                    return (
                      <tr
                        key={idx}
                        className={`border-t border-gray-100 align-top ${rowBg}`}
                      >
                        {/* Exclude checkbox */}
                        <td className="px-3 py-2">
                          <input
                            id={`exclude-row-${idx}`}
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleExclude(idx)}
                            aria-label={`Exclude row ${idx + 1}`}
                            className="accent-gray-500 cursor-pointer"
                          />
                        </td>

                        {/* Row number */}
                        <td className="px-3 py-2 text-gray-400 tabular-nums">
                          {idx + 1}
                        </td>

                        {/* Data cells */}
                        <td
                          className={`px-3 py-2 font-mono text-xs truncate max-w-[160px] ${
                            isExcluded ? "text-gray-400 line-through" : ""
                          }`}
                          title={row.recipient_address}
                        >
                          {row.recipient_address || (
                            <span className="text-gray-300 italic">
                              (empty)
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            isExcluded ? "text-gray-400 line-through" : ""
                          }`}
                        >
                          {row.amount}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            isExcluded ? "text-gray-400 line-through" : ""
                          }`}
                        >
                          {row.deadline_days}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            isExcluded ? "text-gray-400 line-through" : ""
                          }`}
                        >
                          {row.token}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          {isExcluded ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-500">
                              Excluded
                            </span>
                          ) : hasErrors ? (
                            <ul className="space-y-0.5">
                              {rowResult.errors.map((err, ei) => (
                                <li
                                  key={ei}
                                  className="flex items-start gap-1 text-red-600 text-xs"
                                >
                                  <span aria-hidden="true">✗</span>
                                  {err}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <span aria-hidden="true">✓</span> Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Import button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                id="import-submit-btn"
                onClick={handleSubmit}
                disabled={importDisabled}
                className="flex-1 bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? "Creating invoices…"
                  : `Create ${includableValidCount} Invoice${
                      includableValidCount !== 1 ? "s" : ""
                    }`}
              </button>

              {importDisabled && !loading && (
                <p className="text-sm text-gray-400">
                  {summary.invalid > 0
                    ? "Fix or exclude all invalid rows to enable import."
                    : "No valid rows selected."}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
