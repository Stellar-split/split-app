import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
import type { Invoice } from '@stellar-split/sdk';
import {

  filterInvoices,
  invoicesToExportRows,
  lineItemsToExportRows,
  transactionsToExportRows,
  generateExcelBinary,
  generateExportFilename,
  type ExportFilterOptions,
} from '@/lib/invoiceExcelExport';
import { assertCsrf } from '@/lib/middleware/csrfMiddleware';


interface ExportRequest {
  invoices: Invoice[];
  filters?: ExportFilterOptions;
}

/**
 * POST /api/invoices/export
 * Generate and return Excel export of invoices with multiple worksheets
 *
 * Query params (optional, merged with body filters):
 *   from  – ISO date string (YYYY-MM-DD), maps to filters.startDate
 *   to    – ISO date string (YYYY-MM-DD), maps to filters.endDate (end of day)
 *
 * For exports < 500 invoices: returns file directly with 200 OK
 * For exports >= 500 invoices: returns job ID with 202 Accepted for async processing
 */
export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body: ExportRequest = await request.json();
    const { invoices, filters = {} } = body;

    if (!invoices || !Array.isArray(invoices)) {
      return NextResponse.json(
        { error: 'Invalid request: invoices array is required' },
        { status: 400 }
      );
    }

    // Merge query-param date range into filters (query params take precedence)
    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const mergedFilters: ExportFilterOptions = { ...filters };

    if (fromParam) {
      const fromTs = new Date(fromParam).getTime();
      if (!isNaN(fromTs)) {
        mergedFilters.startDate = fromTs / 1000;
      }
    }

    if (toParam) {
      // Include the full end day
      const toDate = new Date(toParam);
      toDate.setHours(23, 59, 59, 999);
      const toTs = toDate.getTime();
      if (!isNaN(toTs)) {
        mergedFilters.endDate = toTs / 1000;
      }
    }

    // Validate date range when both are provided
    if (mergedFilters.startDate !== undefined && mergedFilters.endDate !== undefined) {
      if (mergedFilters.startDate > mergedFilters.endDate) {
        return NextResponse.json(
          { error: '"from" date must not be after "to" date.' },
          { status: 400 }
        );
      }
    }

    // Filter invoices based on merged filters
    const filteredInvoices = filterInvoices(invoices, mergedFilters);

    // Check if we need async processing
    const ASYNC_THRESHOLD = 500;
    if (filteredInvoices.length >= ASYNC_THRESHOLD) {
      // For large exports, return a job ID
      // In production, this would queue the job for background processing
      const jobId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Store job info in a session or database (simplified here)
      // In production: save to database with status 'processing'

      return NextResponse.json(
        {
          jobId,
          status: 'processing',
          estimatedTime: `${Math.ceil(filteredInvoices.length / 100)}s`,
        },
        { status: 202 }
      );
    }

    // Generate export data for synchronous download
    const invoiceRows = invoicesToExportRows(filteredInvoices);
    const lineItemRows = lineItemsToExportRows(filteredInvoices);
    const transactionRows = transactionsToExportRows(filteredInvoices);

    const sheets = [
      {
        name: 'Invoices',
        headers: [
          'Invoice ID',
          'Status',
          'Creator',
          'Total Amount',
          'Funded Amount',
          'Remaining Amount',
          'Recipients',
          'Deadline',
          'Created',
          'Token',
        ],
        rows: invoiceRows.map((row) => ({
          'Invoice ID': row.invoiceId,
          Status: row.status,
          Creator: row.creator,
          'Total Amount': row.totalAmount,
          'Funded Amount': row.fundedAmount,
          'Remaining Amount': row.remainingAmount,
          Recipients: row.recipientCount,
          Deadline: row.deadline,
          Created: row.createdAt,
          Token: row.token,
        })),
      },
      {
        name: 'Line Items',
        headers: ['Invoice ID', 'Recipient Address', 'Amount', 'Status'],
        rows: lineItemRows.map((row) => ({
          'Invoice ID': row.invoiceId,
          'Recipient Address': row.recipientAddress,
          Amount: row.amount,
          Status: row.status,
        })),
      },
      {
        name: 'Transactions',
        headers: ['Invoice ID', 'Payer', 'Amount', 'Timestamp', 'TX Hash', 'Status'],
        rows: transactionRows.map((row) => ({
          'Invoice ID': row.invoiceId,
          Payer: row.payer,
          Amount: row.amount,
          Timestamp: row.timestamp,
          'TX Hash': row.txHash,
          Status: row.status,
        })),
      },
    ];

    // Generate Excel binary (now async)
    const excelData = await generateExcelBinary(sheets);

    // Return file
    const filename = generateExportFilename('invoices');
    return new NextResponse(excelData as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelData.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting invoices:', error);
    return NextResponse.json(
      { error: 'Failed to export invoices' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invoices/export/[jobId]
 * Poll for job completion and download when ready
 */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }

    // In production: fetch job status from database
    // For now, return a placeholder response

    return NextResponse.json(
      {
        jobId,
        status: 'processing',
        percentComplete: 45,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching export job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export job' },
      { status: 500 }
    );
  }
}
