/**
 * csvExport.ts — Utility functions for exporting data to CSV format
 */

import type { Payment } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";

export type PaymentWithMeta = Payment & { timestamp?: number; txHash?: string };

export interface PaymentExportRow {
  payer_address: string;
  amount_usdc: string;
  timestamp: string;
  tx_hash: string;
}

export const PAYMENT_EXPORT_COLUMNS = [
  "payer_address",
  "amount_usdc",
  "timestamp",
  "tx_hash",
] as const;

export type PaymentExportColumn = (typeof PAYMENT_EXPORT_COLUMNS)[number];

export const PAYMENT_EXPORT_COLUMN_LABELS: Record<PaymentExportColumn, string> = {
  payer_address: "Payer Address",
  amount_usdc: "Amount (USDC)",
  timestamp: "Timestamp",
  tx_hash: "Transaction Hash",
};

const PAYMENT_FIELD_GETTERS: Record<
  PaymentExportColumn,
  (payment: PaymentWithMeta) => string
> = {
  payer_address: (payment) => escapeCSVField(payment.payer),
  amount_usdc: (payment) => formatAmount(payment.amount),
  timestamp: (payment) => formatTimestamp(payment.timestamp),
  tx_hash: (payment) => escapeCSVField(payment.txHash || ""),
};

/**
 * Convert payments array to CSV string
 */
export function paymentsToCSV(
  payments: PaymentWithMeta[],
  columns: readonly PaymentExportColumn[] = PAYMENT_EXPORT_COLUMNS
): string {
  const activeColumns = columns.length > 0 ? columns : PAYMENT_EXPORT_COLUMNS;
  const rows = [activeColumns.join(",")];

  // Add data rows
  for (const payment of payments) {
    const row = activeColumns.map((column) =>
      PAYMENT_FIELD_GETTERS[column](payment)
    );
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Escape a single CSV field: quote when it contains a delimiter, quote,
 * CR/LF, or leading/trailing whitespace, and double any embedded quotes.
 */
export function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str === "") return "";
  if (/[",\r\n]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string): string {
  return escapeCsvValue(field);
}

/**
 * Format timestamp for CSV export
 */
function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "";
  
  // Convert from seconds to milliseconds if needed
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const date = new Date(ms);
  
  // Format as ISO 8601 string
  return date.toISOString();
}

/** A single CSV data row: column key to cell value. */
export type CsvRow = Record<string, string | number | boolean | null | undefined>;

/** Options for {@link generateCsv}. */
export interface GenerateCsvOptions {
  /** Custom header labels keyed by column key. Defaults to the column keys. */
  headers?: Record<string, string>;
  /** Explicit column order. Defaults to the keys of the first row. */
  columns?: string[];
}

/**
 * Build a CSV string from rows, quoting and escaping special characters.
 */
export function rowsToCsv(rows: CsvRow[], options: GenerateCsvOptions = {}): string {
  if (rows.length === 0) return "";

  const columns = options.columns ?? Object.keys(rows[0]);
  const headerRow = columns.map((column) =>
    escapeCSVField(options.headers?.[column] ?? column)
  );

  const lines = [headerRow.join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((column) => {
          const value = row[column];
          return escapeCSVField(value === null || value === undefined ? "" : String(value));
        })
        .join(",")
    );
  }

  return lines.join("\n");
}

/**
 * Generate a CSV file from rows and trigger a browser download.
 * Does nothing when there are no rows or when running outside the browser.
 */
export function generateCsv(
  rows: CsvRow[],
  filename: string,
  options: GenerateCsvOptions = {}
): void {
  if (typeof window === "undefined" || rows.length === 0) return;

  const csv = rowsToCsv(rows, options);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  if (typeof window === "undefined") return;
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for payment export
 */
export function generatePaymentExportFilename(invoiceId: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `payments-invoice-${invoiceId}-${date}.csv`;
}

/**
 * Filter payments by date range
 */
export function filterPaymentsByDateRange(
  payments: PaymentWithMeta[],
  startDate: string | null,
  endDate: string | null
): PaymentWithMeta[] {
  if (!startDate && !endDate) return payments;
  
  return payments.filter((payment) => {
    if (!payment.timestamp) return true;
    
    const paymentDate = new Date(
      payment.timestamp < 10000000000 ? payment.timestamp * 1000 : payment.timestamp
    );
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (paymentDate < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (paymentDate > end) return false;
    }
    
    return true;
  });
}

export interface AgingReportRow {
  bucket: string;
  invoice_count: number;
  total_amount: string;
  overdue_amount: string;
  overdue_rate: string;
}

export interface AgingTrendRow {
  period: string;
  bucket: string;
  invoice_count: number;
  total_amount: string;
  overdue_amount: string;
}

export const AGING_REPORT_COLUMNS = [
  "bucket",
  "invoice_count",
  "total_amount",
  "overdue_amount",
  "overdue_rate",
] as const;

export type AgingReportColumn = (typeof AGING_REPORT_COLUMNS)[number];

export const AGING_REPORT_COLUMN_LABELS: Record<AgingReportColumn, string> = {
  bucket: "Aging Bucket",
  invoice_count: "Invoice Count",
  total_amount: "Total Amount (USDC)",
  overdue_amount: "Overdue Amount (USDC)",
  overdue_rate: "Overdue Rate",
};

export const AGING_TREND_COLUMNS = [
  "period",
  "bucket",
  "invoice_count",
  "total_amount",
  "overdue_amount",
] as const;

export type AgingTrendColumn = (typeof AGING_TREND_COLUMNS)[number];

export const AGING_TREND_COLUMN_LABELS: Record<AgingTrendColumn, string> = {
  period: "Period",
  bucket: "Aging Bucket",
  invoice_count: "Invoice Count",
  total_amount: "Total Amount (USDC)",
  overdue_amount: "Overdue Amount (USDC)",
};

/**
 * Convert aging bucket rows to CSV string
 */
export function agingReportToCSV(
  rows: AgingReportRow[],
  columns: readonly AgingReportColumn[] = AGING_REPORT_COLUMNS
): string {
  const activeColumns = columns.length > 0 ? columns : AGING_REPORT_COLUMNS;
  const lines = [activeColumns.join(",")];

  for (const row of rows) {
    lines.push(
      activeColumns
        .map((column) => escapeCSVField(String(row[column] ?? "")))
        .join(",")
    );
  }

  return lines.join("\n");
}

/**
 * Convert aging trend rows to CSV string
 */
export function agingTrendToCSV(
  rows: AgingTrendRow[],
  columns: readonly AgingTrendColumn[] = AGING_TREND_COLUMNS
): string {
  const activeColumns = columns.length > 0 ? columns : AGING_TREND_COLUMNS;
  const lines = [activeColumns.join(",")];

  for (const row of rows) {
    lines.push(
      activeColumns
        .map((column) => escapeCSVField(String(row[column] ?? "")))
        .join(",")
    );
  }

  return lines.join("\n");
}

/**
 * Generate filename for aging report export
 */
export function generateAgingReportFilename(
  reportType: "aging" | "trend" = "aging"
): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `invoice-${reportType}-report-${date}.csv`;
}

export interface CsvRow {
  [key: string]: string | number | null | undefined;
}

export interface CsvOptions {
  /** Column order / selection. Defaults to the keys of the first row. */
  columns?: readonly string[];
  /** Optional header row. Defaults to the column names. */
  headers?: readonly string[];
  /** Optional footer rows appended after the data rows. */
  footers?: readonly (readonly (string | number | null | undefined)[])[];
  /** Line terminator. Defaults to "\n". */
  lineEnding?: string;
  /** Prepend a UTF-8 BOM so Excel detects the encoding. Defaults to false. */
  bom?: boolean;
}

/**
 * Escape a single CSV field: quote when it contains a delimiter, quote,
 * CR/LF, or leading/trailing whitespace, and double any embedded quotes.
 */
export function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str === "") return "";
  if (/[",\r\n]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize rows to a valid CSV string (no download side effects).
 */
export function rowsToCsv(rows: CsvRow[], options: CsvOptions = {}): string {
  const columns = options.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  if (columns.length === 0) return "";

  const lineEnding = options.lineEnding ?? "\n";
  const headerRow = options.headers ?? columns;
  const lines: string[] = [headerRow.map(escapeCsvValue).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(","));
  }

  for (const footer of options.footers ?? []) {
    lines.push(footer.map(escapeCsvValue).join(","));
  }

  return lines.join(lineEnding);
}

/**
 * Build a CSV file from rows and trigger a browser download.
 */
export function generateCsv(
  rows: CsvRow[],
  filename: string,
  options: CsvOptions = {}
): void {
  if (rows.length === 0) return;

  const csv = rowsToCsv(rows, options);
  const blob = new Blob([options.bom ? `\uFEFF${csv}` : csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
