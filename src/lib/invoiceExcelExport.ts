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

export interface AgingBucketExportRow {
  bucket: string;
  invoiceCount: number;
  outstandingAmount: string;
  overdueAmount: string;
  overdueRate: string;
  collectionEfficiency: string;
}

export interface AgingTrendExportRow {
  period: string;
  invoiceCount: number;
  outstandingAmount: string;
  overdueAmount: string;
  overdueRate: string;
  collectionEfficiency: string;
}

export interface AgingReportExport {
  buckets: AgingBucketExportRow[];
  trends: AgingTrendExportRow[];
}

/** Aging bucket definitions, ordered from current to most overdue. */
export const AGING_BUCKETS: Array<{ label: string; minDays: number; maxDays: number }> = [
  { label: 'Current', minDays: -Infinity, maxDays: 0 },
  { label: '1-30 days', minDays: 1, maxDays: 30 },
  { label: '31-60 days', minDays: 31, maxDays: 60 },
  { label: '61-90 days', minDays: 61, maxDays: 90 },
  { label: '90+ days', minDays: 91, maxDays: Infinity },
];

const DAY_SECONDS = 86400;

function invoiceTotal(invoice: Invoice): bigint {
  return invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);
}

function invoiceOutstanding(invoice: Invoice): bigint {
  const outstanding = invoiceTotal(invoice) - invoice.funded;
  return outstanding > 0n ? outstanding : 0n;
}

function daysOverdue(invoice: Invoice, nowSeconds: number): number {
  if (!invoice.deadline || invoice.deadline <= 0) return 0;
  return Math.floor((nowSeconds - invoice.deadline) / DAY_SECONDS);
}

function bucketForDays(days: number): string {
  for (const bucket of AGING_BUCKETS) {
    if (days >= bucket.minDays && days <= bucket.maxDays) return bucket.label;
  }
  return AGING_BUCKETS[AGING_BUCKETS.length - 1].label;
}

function formatRate(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) return '0.00%';
  const scaled = (numerator * 10000n) / denominator;
  return `${(Number(scaled) / 100).toFixed(2)}%`;
}

/**
 * Build aging bucket and trend rows for the aging report worksheet.
 * Uses the same filter options as the invoice export so the aging report
 * reflects exactly the invoices being exported.
 */
export function buildAgingReport(
  invoices: Invoice[],
  options: ExportFilterOptions = {},
  nowSeconds: number = Math.floor(Date.now() / 1000)
): AgingReportExport {
  const filtered = filterInvoices(invoices, options);

  const bucketTotals = new Map<
    string,
    { count: number; outstanding: bigint; overdue: bigint; collected: bigint; total: bigint }
  >();
  for (const bucket of AGING_BUCKETS) {
    bucketTotals.set(bucket.label, {
      count: 0,
      outstanding: 0n,
      overdue: 0n,
      collected: 0n,
      total: 0n,
    });
  }

  const trendTotals = new Map<
    string,
    { count: number; outstanding: bigint; overdue: bigint; collected: bigint; total: bigint }
  >();

  for (const invoice of filtered) {
    const total = invoiceTotal(invoice);
    const outstanding = invoiceOutstanding(invoice);
    const days = daysOverdue(invoice, nowSeconds);
    const isOverdue = days > 0 && outstanding > 0n;
    const overdue = isOverdue ? outstanding : 0n;
    const collected = invoice.funded > 0n ? invoice.funded : 0n;

    const bucketLabel = bucketForDays(days);
    const bucket = bucketTotals.get(bucketLabel)!;
    bucket.count += 1;
    bucket.outstanding += outstanding;
    bucket.overdue += overdue;
    bucket.collected += collected;
    bucket.total += total;

    const period = new Date(
      (invoice.deadline > 0 ? invoice.deadline : nowSeconds) * 1000
    ).toISOString().slice(0, 7);
    const trend = trendTotals.get(period) ?? {
      count: 0,
      outstanding: 0n,
      overdue: 0n,
      collected: 0n,
      total: 0n,
    };
    trend.count += 1;
    trend.outstanding += outstanding;
    trend.overdue += overdue;
    trend.collected += collected;
    trend.total += total;
    trendTotals.set(period, trend);
  }

  const buckets: AgingBucketExportRow[] = AGING_BUCKETS.map((bucket) => {
    const totals = bucketTotals.get(bucket.label)!;
    return {
      bucket: bucket.label,
      invoiceCount: totals.count,
      outstandingAmount: formatAmount(totals.outstanding),
      overdueAmount: formatAmount(totals.overdue),
      overdueRate: formatRate(totals.overdue, totals.outstanding),
      collectionEfficiency: formatRate(totals.collected, totals.total),
    };
  });

  const trends: AgingTrendExportRow[] = Array.from(trendTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, totals]) => ({
      period,
      invoiceCount: totals.count,
      outstandingAmount: formatAmount(totals.outstanding),
      overdueAmount: formatAmount(totals.overdue),
      overdueRate: formatRate(totals.overdue, totals.outstanding),
      collectionEfficiency: formatRate(totals.collected, totals.total),
    }));

  return { buckets, trends };
}

/**
 * Build the aging worksheet definition (bucket summary + trend rows)
 * for inclusion in the generated Excel workbook.
 */
export function buildAgingWorksheet(
  invoices: Invoice[],
  options: ExportFilterOptions = {},
  nowSeconds: number = Math.floor(Date.now() / 1000)
): { name: string; headers: string[]; rows: Record<string, string | number>[] } {
  const report = buildAgingReport(invoices, options, nowSeconds);

  const headers = [
    'Section',
    'Period / Bucket',
    'Invoice Count',
    'Outstanding Amount',
    'Overdue Amount',
    'Overdue Rate',
    'Collection Efficiency',
  ];

  const rows: Record<string, string | number>[] = [
    ...report.buckets.map((bucket) => ({
      Section: 'Aging Bucket',
      'Period / Bucket': bucket.bucket,
      'Invoice Count': bucket.invoiceCount,
      'Outstanding Amount': bucket.outstandingAmount,
      'Overdue Amount': bucket.overdueAmount,
      'Overdue Rate': bucket.overdueRate,
      'Collection Efficiency': bucket.collectionEfficiency,
    })),
    ...report.trends.map((trend) => ({
      Section: 'Trend',
      'Period / Bucket': trend.period,
      'Invoice Count': trend.invoiceCount,
      'Outstanding Amount': trend.outstandingAmount,
      'Overdue Amount': trend.overdueAmount,
      'Overdue Rate': trend.overdueRate,
      'Collection Efficiency': trend.collectionEfficiency,
    })),
  ];

  return { name: 'Aging Report', headers, rows };
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
      // `timestamp` is set at runtime by the indexer but is not part of the
      // published SDK Payment type — read it defensively.
      const timestamp = (payment as { timestamp?: number }).timestamp;
      rows.push({
        invoiceId: invoice.id,
        payer: payment.payer,
        amount: formatAmount(payment.amount),
        timestamp: timestamp
          ? new Date(
              timestamp < 10000000000
                ? timestamp * 1000
                : timestamp
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
 * This creates a valid Excel file with multiple worksheets using exceljs
 */
export async function generateExcelBinary(
  sheets: Array<{
    name: string;
    headers: string[];
    rows: Record<string, string | number>[];
  }>
): Promise<Uint8Array> {
  // Dynamic import to avoid issues with CommonJS in Edge Runtime
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  for (const sheetData of sheets) {
    const worksheet = workbook.addWorksheet(sheetData.name);

    // Add headers
    worksheet.columns = sheetData.headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 2, 15), 50),
    }));

    // Freeze header row
    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    // Style headers
    worksheet.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };
    worksheet.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Add data rows
    for (const row of sheetData.rows) {
      worksheet.addRow(row);
    }

    // Format data cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
          };
        });
      }
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/**
 * Download export data as Excel file
 */
export function downloadExcel(
  data: Uint8Array,
  filename: string
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([data as unknown as BlobPart], {
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

/**
 * Generate Excel binary data including the aging report worksheet.
 * Reuses the existing filter options so the aging sheet matches the
 * invoices, line items and transactions being exported.
 */
export async function generateExcelBinaryWithAging(
  invoices: Invoice[],
  options: ExportFilterOptions = {},
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<Uint8Array> {
  const filtered = filterInvoices(invoices, options);

  const sheets = [
    {
      name: 'Invoices',
      headers: [
        'invoiceId',
        'status',
        'creator',
        'totalAmount',
        'fundedAmount',
        'remainingAmount',
        'recipientCount',
        'deadline',
        'createdAt',
        'token',
      ],
      rows: invoicesToExportRows(filtered) as unknown as Record<string, string | number>[],
    },
    {
      name: 'Line Items',
      headers: ['invoiceId', 'recipientAddress', 'amount', 'status'],
      rows: lineItemsToExportRows(filtered) as unknown as Record<string, string | number>[],
    },
    {
      name: 'Transactions',
      headers: ['invoiceId', 'payer', 'amount', 'timestamp', 'txHash', 'status'],
      rows: transactionsToExportRows(filtered) as unknown as Record<string, string | number>[],
    },
    buildAgingWorksheet(filtered, {}, nowSeconds),
  ];

  return generateExcelBinary(sheets);
}
