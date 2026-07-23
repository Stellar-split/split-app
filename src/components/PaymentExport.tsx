'use client';

import { useState } from 'react';
import type { Payment } from '@stellar-split/sdk';
import {
  paymentsToCSV,
  downloadCSV,
  generatePaymentExportFilename,
  filterPaymentsByDateRange,
} from '@/lib/csvExport';

interface Props {
  invoiceId: string;
  payments: Payment[];
}

export default function PaymentExport({ invoiceId, payments }: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    
    try {
      // Filter payments by date range if specified
      const filteredPayments = filterPaymentsByDateRange(
        payments,
        startDate || null,
        endDate || null
      );

      // Convert to CSV
      const csv = paymentsToCSV(filteredPayments);

      // Download
      const filename = generatePaymentExportFilename(invoiceId);
      downloadCSV(csv, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export payments. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredCount = filterPaymentsByDateRange(
    payments,
    startDate || null,
    endDate || null
  ).length;

  const hasFilters = startDate || endDate;

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-medium text-gray-300">Export Payment History</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors border border-gray-700"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || payments.length === 0}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export Payments CSV'}
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      {showFilters && (
        <div className="border-t border-gray-800 pt-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="flex-1">
              <label htmlFor="start-date" className="block text-xs text-gray-400 mb-1">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="end-date" className="block text-xs text-gray-400 mb-1">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-gray-400">
              {hasFilters ? (
                <>
                  Showing {filteredCount} of {payments.length} payment{payments.length !== 1 ? 's' : ''}
                </>
              ) : (
                <>All {payments.length} payment{payments.length !== 1 ? 's' : ''} will be exported</>
              )}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {payments.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">
          No payments to export yet. Payments will appear here once the invoice receives contributions.
        </p>
      )}

      {/* Export Info */}
      {payments.length > 0 && !showFilters && (
        <p className="text-xs text-gray-500 mt-2">
          CSV will include payer address, amount (USDC), timestamp, and transaction hash for all payments.
        </p>
      )}
    </div>
  );
}
