'use client';

import React, { useState, useCallback } from 'react';
import type { Invoice } from '@stellar-split/sdk';
import type { ExportFilterOptions } from '@/lib/invoiceExcelExport';
import { downloadExcel, generateExportFilename } from '@/lib/invoiceExcelExport';
import { apiFetch } from '@/lib/apiClient';

/** Return a date string in "YYYY-MM-DD" format for an offset of `daysAgo` from today. */
function dateString(daysAgo: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onExport?: () => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  invoices,
  onExport,
}: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date-range state — "From" defaults to 30 days ago, "To" defaults to today
  const [startDate, setStartDate] = useState<string>(() => dateString(30));
  const [endDate, setEndDate] = useState<string>(() => dateString(0));
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  // Other filter state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  // Extract unique statuses and assets from invoices
  const uniqueStatuses = Array.from(
    new Set(invoices.map((inv) => inv.status))
  );
  const uniqueAssets = Array.from(
    new Set(invoices.map((inv) => inv.token || 'USDC'))
  );

  const handleStatusChange = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleAssetChange = (asset: string) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  };

  /** Validate date range and return true when valid. */
  const validateDateRange = (): boolean => {
    if (startDate && endDate && startDate > endDate) {
      setDateRangeError('"From" date must not be after "To" date.');
      return false;
    }
    setDateRangeError(null);
    return true;
  };

  const handleExport = useCallback(async () => {
    if (!validateDateRange()) return;

    setIsExporting(true);
    setError(null);

    try {
      const filters: ExportFilterOptions = {};

      if (startDate) {
        filters.startDate = new Date(startDate).getTime() / 1000;
      }
      if (endDate) {
        // Include the full end day by advancing to end-of-day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end.getTime() / 1000;
      }
      if (selectedStatuses.length > 0) {
        filters.statuses = selectedStatuses;
      }
      if (selectedAssets.length > 0) {
        filters.assets = selectedAssets;
      }

      // Build query params so the API route can also filter server-side
      const params = new URLSearchParams();
      if (startDate) params.set('from', startDate);
      if (endDate) params.set('to', endDate);

      const response = await apiFetch(`/api/invoices/export?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices,
          filters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Handle async export (202 Accepted)
      if (response.status === 202) {
        const jobData = await response.json();
        setError(`Export queued as job ${jobData.jobId}. This will be processed in the background.`);
        return;
      }

      // Handle synchronous export (200 OK)
      const blob = await response.blob();
      const filename = generateExportFilename('invoices');

      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onExport?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, startDate, endDate, selectedStatuses, selectedAssets, onExport, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Export Invoices</h2>
            <p className="text-sm text-gray-600 mt-1">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="export-from"
                  className="block text-xs text-gray-500 mb-1"
                >
                  From
                </label>
                <input
                  id="export-from"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateRangeError(null);
                  }}
                  disabled={isExporting}
                  aria-describedby={dateRangeError ? 'export-date-error' : undefined}
                  aria-invalid={!!dateRangeError}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label
                  htmlFor="export-to"
                  className="block text-xs text-gray-500 mb-1"
                >
                  To
                </label>
                <input
                  id="export-to"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateRangeError(null);
                  }}
                  disabled={isExporting}
                  aria-describedby={dateRangeError ? 'export-date-error' : undefined}
                  aria-invalid={!!dateRangeError}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            {dateRangeError && (
              <p
                id="export-date-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {dateRangeError}
              </p>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="space-y-2">
              {uniqueStatuses.map((status) => (
                <label key={status} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => handleStatusChange(status)}
                    disabled={isExporting}
                    className="w-4 h-4 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Asset Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assets
            </label>
            <div className="space-y-2">
              {uniqueAssets.map((asset) => (
                <label key={asset} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(asset)}
                    onChange={() => handleAssetChange(asset)}
                    disabled={isExporting}
                    className="w-4 h-4 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{asset}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || invoices.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
