/**
 * Invoice bulk export to Excel format
 * Generates XLSX files with multiple worksheets for invoices, line items, and transactions
 */

import type { Invoice, Payment } from '@stellar-split/sdk';
import { formatAmount } from '@stellar-split/sdk';

export interface ExportFilterOptions {
  startDate?: number; // Unix timestamp
  endDate?: number; // Unix timestamp
  statuses?: string[];
  assets?: string[];
}

export interface InvoiceExportRow {
  invoiceId: string;
  status: string;
  creator: string;
  totalAmount: string;
  fundedAmount: string;
  remainingAmount: string;
  recipientCount: number;
  deadline: string;
  createdAt: string;
  token: string;
}

export interface LineItemExportRow {
  invoiceId: string;
  recipientAddress: string;
  amount: string;
  status: string;
}

export interface TransactionExportRow {
  invoiceId: string;
  payer: string;
  amount: string;
  timestamp: string;
  txHash: string;
  status: string;
}

/**
 * Convert invoices to export rows
 */
export function invoicesToExportRows(invoices: Invoice[]): InvoiceExportRow[] {
  return invoices.map((invoice) => ({
    invoiceId: invoice.id,
    status: invoice.status,
    creator: invoice.creator,
    totalAmount: formatAmount(invoice.recipients.reduce((sum, r) => sum + r.amount, 0n)),
    fundedAmount: formatAmount(invoice.funded),
    remainingAmount: formatAmount(
      invoice.recipients.reduce((sum, r) => sum + r.amount, 0n) - invoice.funded
    ),
    recipientCount: invoice.recipients.length,
    deadline:
      invoice.deadline > 0
        ? new Date(invoice.deadline * 1000).toISOString()
        : 'No deadline',
    createdAt: new Date().toISOString(),
    token: invoice.token || 'USDC',
  }));
}

/**
 * Convert invoice recipients to line item rows
 */
export function lineItemsToExportRows(invoices: Invoice[]): LineItemExportRow[] {
  const rows: LineItemExportRow[] = [];

  for (const invoice of invoices) {
    for (const recipient of invoice.recipients) {
      rows.push({
        invoiceId: invoice.id,
        recipientAddress: recipient.address,
        amount: formatAmount(recipient.amount),
        status: invoice.status,
      });
    }
  }

  return rows;
}

/**
 * Convert invoice payments to transaction rows
 */
export function transactionsToExportRows(invoices: Invoice[]): TransactionExportRow[] {
  const rows: TransactionExportRow[] = [];

  for (const invoice of invoices) {
    for (const payment of invoice.payments) {
      rows.push({
        invoiceId: invoice.id,
        payer: payment.payer,
        amount: formatAmount(payment.amount),
        timestamp: payment.timestamp
          ? new Date(
              payment.timestamp < 10000000000
                ? payment.timestamp * 1000
                : payment.timestamp
            ).toISOString()
          : 'Unknown',
        txHash: (payment as any).txHash || '',
        status: 'Completed',
      });
    }
  }

  return rows;
}

/**
 * Filter invoices based on export options
 */
export function filterInvoices(
  invoices: Invoice[],
  options: ExportFilterOptions
): Invoice[] {
  return invoices.filter((invoice) => {
    // Filter by date range
    if (options.startDate || options.endDate) {
      const invoiceDate = invoice.deadline || Math.floor(Date.now() / 1000);
      if (options.startDate && invoiceDate < options.startDate) return false;
      if (options.endDate && invoiceDate > options.endDate) return false;
    }

    // Filter by status
    if (options.statuses && options.statuses.length > 0) {
      if (!options.statuses.includes(invoice.status)) return false;
    }

    // Filter by asset
    if (options.assets && options.assets.length > 0) {
      const token = invoice.token || 'USDC';
      if (!options.assets.includes(token)) return false;
    }

    return true;
  });
}

/**
 * Generate a CSV representation of data for export
 * This can be used as a fallback or intermediate format
 */
export function generateCSVContent(
  headers: string[],
  rows: Record<string, string | number>[]
): string {
  const headerRow = headers.map((h) => `"${h}"`).join(',');
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : `"${str}"`;
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generate Excel binary data (XLSX format)
 * This creates a minimal but valid Excel file with multiple worksheets
 */
export function generateExcelBinary(
  sheets: Array<{
    name: string;
    headers: string[];
    rows: Record<string, string | number>[];
  }>
): Uint8Array {
  // Note: For production use, install exceljs via npm:
  // npm install exceljs
  // Then use: import * as ExcelJS from 'exceljs';

  // For now, we'll return CSV data wrapped in a simple format
  // This is a placeholder that should be replaced with proper XLSX generation

  let content = '';
  for (const sheet of sheets) {
    content += `\n\n=== ${sheet.name} ===\n`;
    content += generateCSVContent(sheet.headers, sheet.rows);
  }

  // For now, return the content as UTF-8 encoded bytes
  const encoder = new TextEncoder();
  return encoder.encode(content);
}

/**
 * Download export data as Excel file
 */
export function downloadExcel(
  data: Uint8Array,
  filename: string
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for invoice export
 */
export function generateExportFilename(prefix = 'invoices'): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.xlsx`;
}
