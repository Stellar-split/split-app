"use client";

import { useRef, useState } from "react";

export interface CsvValidationError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export interface CsvRow {
  address: string;
  /** percentage (0-100) or absolute amount string */
  percentage?: string;
  amount?: string;
  /** validation error message, if any */
  error?: string;
  /** structured validation errors for this row, if any */
  errors?: CsvValidationError[];
}

interface Props {
  onImport: (rows: Array<{ address: string; amount: string }>) => void;
  existingCount?: number;
}

const MAX_RECIPIENTS = 20;
const MAX_ERRORS = 20;

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
    // Trim every column value to remove spreadsheet export artifacts
    const cols = line.split(",").map((c) => c.trim());
    const address = (addrIdx >= 0 ? (cols[addrIdx] ?? "") : (cols[0] ?? "")).trim();
    const percentage = pctIdx >= 0 ? (cols[pctIdx] ?? "").trim() : undefined;
    const amount = amtIdx >= 0
      ? (cols[amtIdx] ?? "").trim()
      : pctIdx < 0
        ? (cols[1] ?? "").trim()
        : undefined;
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
  let errorCount = 0;

  return rows.map((row, idx): CsvRow => {
    const errors: CsvValidationError[] = [];
    const rowNumber = idx + 2; // +1 for header, +1 for 1-based rows

    const pushError = (column: string, value: string, message: string) => {
      if (errorCount >= MAX_ERRORS) return;
      errors.push({ row: rowNumber, column, value, message });
      errorCount += 1;
    };

    if (!isValidStellarAddress(row.address)) {
      pushError("address", row.address, "Address must be a valid Stellar address");
    } else if (seen.has(row.address)) {
      pushError("address", row.address, "Address is a duplicate of an earlier row");
    } else {
      seen.add(row.address);
    }

    if (usePercent) {
      const pct = parseFloat(row.percentage ?? "");
      if (isNaN(pct) || pct <= 0) {
        pushError("percentage", row.percentage ?? "", "Percentage must be a positive number");
      } else {
        pctSum += pct;
        if (pctSum > 100) {
          pushError("percentage", row.percentage ?? "", "Percentage total exceeds 100%");
        }
      }
    } else {
      const amt = parseFloat(row.amount ?? "");
      if (isNaN(amt) || amt <= 0) {
        pushError("amount", row.amount ?? "", "Amount must be a positive number");
      }
    }

    if (tooMany && existingCount + idx + 1 > MAX_RECIPIENTS) {
      pushError("address", row.address, `Maximum of ${MAX_RECIPIENTS} recipients allowed`);
    }

    return {
      ...row,
      errors: errors.length > 0 ? errors : undefined,
      error: errors.length > 0 ? errors.map((e) => e.message).join("; ") : undefined,
    };
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
    // Trim whitespace so inline edits are treated consistently with CSV parse
    const updated = rows.map((r, i) => (i === idx ? { ...r, [field]: value.trim() } : r));
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
                        className="w-full bg-transparent font-mon

/* … truncated 2722 chars — edit only what you need near the top … */
