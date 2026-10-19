// src/lib/paymentExport.ts
import {
  paymentsToCSV,
  filterPaymentsByDateRange,
} from './csvExport';
import {
  buildPaymentSummaryHtml,
  downloadPaymentSummaryPDF,
} from './paymentExportPdf';

/**
 * Supported export formats for payment data.
 */
export type PaymentExportFormat = 'csv' | 'json' | 'pdf';

/**
 * Filter object accepted by the export helpers.
 */
export interface PaymentExportFilters {
  startDate?: string;
  endDate?: string;
  statuses?: string[];
}

/**
 * Minimal shape of a payment record used by the export module.
 * Kept intentionally loose so it can accommodate the various
 * payment shapes used across the app.
 */
export interface ExportablePayment {
  id?: string;
  invoiceId?: string;
  invoice_id?: string;
  amount?: number;
  status?: string;
  date?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Minimal shape of an invoice record used for reconciliation.
 */
export interface ExportableInvoice {
  id?: string;
  invoiceId?: string;
  invoice_id?: string;
  amount?: number;
  total?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * Result of a reconciliation run for a single invoice.
 */
export interface ReconciliationEntry {
  invoiceId: string;
  expected: number;
  received: number;
  discrepancy: number;
  matchedPayments: number;
  status: 'matched' | 'underpaid' | 'overpaid' | 'unpaid';
}

/**
 * Full reconciliation report summary.
 */
export interface ReconciliationReport {
  entries: ReconciliationEntry[];
  totals: {
    expected: number;
    received: number;
    discrepancy: number;
  };
  discrepancies: ReconciliationEntry[];
  generatedAt: string;
}

const EPSILON = 0.005;

function getPaymentDate(payment: ExportablePayment): string | undefined {
  return (
    (payment.date as string | undefined) ??
    (payment.createdAt as string | undefined) ??
    (payment.created_at as string | undefined)
  );
}

function getPaymentInvoiceId(payment: ExportablePayment): string | undefined {
  const raw =
    payment.invoiceId ??
    payment.invoice_id ??
    (payment as Record<string, unknown>).invoice;
  return raw === undefined || raw === null ? undefined : String(raw);
}

function getInvoiceId(invoice: ExportableInvoice): string | undefined {
  const raw = invoice.id ?? invoice.invoiceId ?? invoice.invoice_id;
  return raw === undefined || raw === null ? undefined : String(raw);
}

function getInvoiceAmount(invoice: ExportableInvoice): number {
  const raw = invoice.amount ?? invoice.total ?? 0;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function getPaymentAmount(payment: ExportablePayment): number {
  const raw = payment.amount ?? 0;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Applies date-range and invoice-status filters to a list of payments.
 *
 * - Date range filtering is delegated to `filterPaymentsByDateRange`.
 * - Status filtering matches against the payment's `status` field
 *   (case-insensitive). An empty/undefined `statuses` array disables
 *   status filtering.
 */
export function filterPayments<T extends ExportablePayment>(
  payments: T[],
  filters: PaymentExportFilters = {},
): T[] {
  if (!Array.isArray(payments)) {
    return [];
  }

  let result: T[] = payments;

  const { startDate, endDate, statuses } = filters;

  if (startDate || endDate) {
    result = filterPaymentsByDateRange(
      result as unknown as Record<string, unknown>[],
      startDate,
      endDate,
    ) as unknown as T[];
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    const normalized = new Set(
      statuses
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.toLowerCase()),
    );
    result = result.filter((payment) => {
      const status = payment.status;
      return typeof status === 'string' && normalized.has(status.toLowerCase());
    });
  }

  return result;
}

function triggerDownload(content: string, filename: string, mime: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildFilename(format: PaymentExportFormat): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `payments-export-${stamp}.${format}`;
}

/**
 * Serializes payments to JSON.
 */
export function paymentsToJSON(payments: ExportablePayment[]): string {
  return JSON.stringify(payments ?? [], null, 2);
}

/**
 * Exports payments in the requested format and triggers the appropriate
 * download. Returns the serialized content (useful for testing).
 */
export function exportPayments(
  payments: ExportablePayment[],
  format: PaymentExportFormat,
  filters: PaymentExportFilters = {},
): string {
  const filtered = filterPayments(payments, filters);
  const filename = buildFilename(format);

  switch (format) {
    case 'csv': {
      const csv = paymentsToCSV(filtered as unknown as Record<string, unknown>[]);
      triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
      return csv;
    }
    case 'json': {
      const json = paymentsToJSON(filtered);
      triggerDownload(json, filename, 'application/json;charset=utf-8;');
      return json;
    }
    case 'pdf': {
      const html = buildPaymentSummaryHtml(filtered as unknown as Record<string, unknown>[]);
      downloadPaymentSummaryPDF(html, filename);
      return html;
    }
    default: {
      throw new Error(`Unsupported payment export format: ${String(format)}`);
    }
  }
}

/**
 * Generates a reconciliation report by matching payments to invoices
 * via invoice id. Computes expected (invoice amount) vs received
 * (sum of matched payments) totals per invoice and surfaces discrepancies.
 */
export function generateReconciliationReport(
  payments: ExportablePayment[],
  invoices: ExportableInvoice[],
): ReconciliationReport {
  const receivedByInvoice = new Map<string, { total: number; count: number }>();

  for (const payment of payments ?? []) {
    const invoiceId = getPaymentInvoiceId(payment);
    if (!invoiceId) continue;
    const amount = getPaymentAmount(payment);
    const existing = receivedByInvoice.get(invoiceId) ?? { total: 0, count: 0 };
    existing.total += amount;
    existing.count += 1;
    receivedByInvoice.set(invoiceId, existing);
  }

  const entries: ReconciliationEntry[] = [];
  const seen = new Set<string>();

  for (const invoice of invoices ?? []) {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId || seen.has(invoiceId)) continue;
    seen.add(invoiceId);

    const expected = getInvoiceAmount(invoice);
    const receivedInfo = receivedByInvoice.get(invoiceId);
    const received = receivedInfo ? receivedInfo.total : 0;
    const discrepancy = roundCurrency(received - expected);

    let status: ReconciliationEntry['status'];
    if (!receivedInfo || receivedInfo.count === 0) {
      status = 'unpaid';
    } else if (Math.abs(discrepancy) <= EPSILON) {
      status = 'matched';
    } else if (discrepancy < 0) {
      status = 'underpaid';
    } else {
      status = 'overpaid';
    }

    entries.push({
      invoiceId,
      expected: roundCurrency(expected),
      received: roundCurrency(received),
      discrepancy,
      matchedPayments: receivedInfo ? receivedInfo.count : 0,
      status,
    });
  }

  // Include payments referencing invoices not present in the invoice list.
  for (const [invoiceId, info] of receivedByInvoice.entries()) {
    if (seen.has(invoiceId)) continue;
    seen.add(invoiceId);
    entries.push({
      invoiceId,
      expected: 0,
      received: roundCurrency(info.total),
      discrepancy: roundCurrency(info.total),
      matchedPayments: info.count,
      status: 'overpaid',
    });
  }

  const totals = entries.reduce(
    (acc, entry) => {
      acc.expected += entry.expected;
      acc.received += entry.received;
      acc.discrepancy += entry.discrepancy;
      return acc;
    },
    { expected: 0, received: 0, discrepancy: 0 },
  );

  const discrepancies = entries.filter(
    (entry) => Math.abs(entry.discrepancy) > EPSILON,
  );

  return {
    entries,
    totals: {
      expected: roundCurrency(totals.expected),
      received: roundCurrency(totals.received),
      discrepancy: roundCurrency(totals.discrepancy),
    },
    discrepancies,
    generatedAt: new Date().toISOString(),
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}