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
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string): string {
  if (!field) return "";
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return field;
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
  [key: string]: string | number;
}

export function generateCsv(rows: CsvRow[], filename: string): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = String(val ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], {
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
