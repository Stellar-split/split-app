"use client";

import { useRef, useState } from "react";

export interface CsvRow {
  address: string;
  /** percentage (0-100) or absolute amount string */
  percentage?: string;
  amount?: string;
  /** validation error message, if any */
  error?: string;
}

interface Props {
  onImport: (rows: Array<{ address: string; amount: string }>) => void;
  existingCount?: number;
}

const MAX_RECIPIENTS = 20;

function isValidStellarAddress(addr: string) {
  return addr.startsWith("G") && addr.length >= 50;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const addrIdx = header.indexOf("address");
  const pctIdx = header.indexOf("percentage");
  const amtIdx = header.indexOf("amount");

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const address = addrIdx >= 0 ? (cols[addrIdx] ?? "") : (cols[0] ?? "");
    const percentage = pctIdx >= 0 ? (cols[pctIdx] ?? "") : undefined;
    const amount = amtIdx >= 0 ? (cols[amtIdx] ?? "") : pctIdx < 0 ? (cols[1] ?? "") : undefined;
    return { address, percentage, amount };
  }).filter((r) => r.address !== "");
}

function validateRows(
  rows: CsvRow[],
  existingCount: number
): CsvRow[] {
  const seen = new Set<string>();
  const usePercent = rows.some((r) => r.percentage !== undefined && r.percentage !== "");

  // Check max recipients across existing + new
  const totalAfterImport = existingCount + rows.length;
  const tooMany = totalAfterImport > MAX_RECIPIENTS;

  let pctSum = 0;

  return rows.map((row, idx): CsvRow => {
    const errors: string[] = [];

    if (!isValidStellarAddress(row.address)) {
      errors.push("Invalid Stellar address");
    } else if (seen.has(row.address)) {
      errors.push("Duplicate address");
    } else {
      seen.add(row.address);
    }

    if (usePercent) {
      const pct = parseFloat(row.percentage ?? "");
      if (isNaN(pct) || pct <= 0) {
        errors.push("Percentage must be > 0");
      } else {
        pctSum += pct;
        if (pctSum > 100) {
          errors.push("Percentage total exceeds 100%");
        }
      }
    } else {
      const amt = parseFloat(row.amount ?? "");
      if (isNaN(amt) || amt <= 0) {
        errors.push("Amount must be > 0");
      }
    }

    if (tooMany && existingCount + idx + 1 > MAX_RECIPIENTS) {
      errors.push(`Max ${MAX_RECIPIENTS} recipients`);
    }

    return { ...row, error: errors.length > 0 ? errors.join("; ") : undefined };
  });
}

export default function CsvRecipientImport({ onImport, existingCount = 0 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);

  const processFile = async (file: File) => {
    setParseError(null);
    setRows([]);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setParseError("No valid rows found. Expected columns: address, percentage (or amount).");
        return;
      }
      setRows(validateRows(parsed, existingCount));
      setOpen(true);
    } catch (err) {
      setParseError(`Could not read file: ${String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleUpdateRow = (
    idx: number,
    field: "address" | "percentage" | "amount",
    value: string
  ) => {
    const updated = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setRows(validateRows(updated, existingCount));
  };

  const handleConfirm = () => {
    const validRows = rows.filter((r) => !r.error);
    const usePercent = rows.some((r) => r.percentage !== undefined && r.percentage !== "");
    onImport(
      validRows.map((r) => ({
        address: r.address,
        amount: usePercent ? (r.percentage ?? "") : (r.amount ?? ""),
      }))
    );
    setRows([]);
    setOpen(false);
  };

  const hasErrors = rows.some((r) => r.error);
  const validCount = rows.filter((r) => !r.error).length;
  const usePercent = rows.some((r) => r.percentage !== undefined && r.percentage !== "");

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger area */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Import CSV — drag and drop or click to select file"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-6 py-5 cursor-pointer transition-colors select-none
          ${dragging
            ? "border-indigo-400 bg-indigo-900/20"
            : "border-gray-600 hover:border-gray-400 bg-gray-800/40"
          }`}
      >
        <span className="text-2xl" aria-hidden="true">📄</span>
        <span className="text-sm font-medium text-gray-300">Import CSV</span>
        <span className="text-xs text-gray-500">
          Drop a .csv file or click to browse · columns: address, percentage (or amount)
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        aria-label="CSV file input"
      />

      {parseError && (
        <p role="alert" className="text-red-400 text-sm">{parseError}</p>
      )}

      {/* Preview table */}
      {open && rows.length > 0 && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-sm text-gray-300">
            {validCount} valid / {rows.length} rows parsed
            {hasErrors && (
              <span className="ml-2 text-yellow-400">
                — fix highlighted rows or they will be skipped
              </span>
            )}
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
                  <th className="text-left px-3 py-2 font-medium">Address</th>
                  <th className="text-left px-3 py-2 font-medium w-28">
                    {usePercent ? "%" : "Amount (USDC)"}
                  </th>
                  <th className="px-3 py-2 font-medium w-8" aria-label="Error" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={row.error ? "bg-red-900/20" : ""}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.address}
                        onChange={(e) => handleUpdateRow(i, "address", e.target.value)}
                        aria-label={`Row ${i + 1} address`}
                        className="w-full bg-transparent font-mono text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        step="0.0000001"
                        min="0"
                        value={usePercent ? (row.percentage ?? "") : (row.amount ?? "")}
                        onChange={(e) =>
                          handleUpdateRow(i, usePercent ? "percentage" : "amount", e.target.value)
                        }
                        aria-label={`Row ${i + 1} ${usePercent ? "percentage" : "amount"}`}
                        className="w-full bg-transparent text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {row.error && (
                        <span
                          title={row.error}
                          aria-label={`Error: ${row.error}`}
                          className="text-red-400 text-xs cursor-help"
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error details */}
          {hasErrors && (
            <ul className="text-xs text-red-400 flex flex-col gap-0.5">
              {rows
                .filter((r) => r.error)
                .map((r, i) => (
                  <li key={i}>
                    Row {rows.indexOf(r) + 1}: {r.error}
                  </li>
                ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={validCount === 0}
              className="min-h-10 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Import {validCount} recipient{validCount !== 1 ? "s" : ""}
            </button>
            <button
              type="button"
              onClick={() => { setRows([]); setOpen(false); }}
              className="min-h-10 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
