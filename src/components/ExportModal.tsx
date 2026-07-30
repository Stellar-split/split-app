'use client';

import React, { useState, useCallback } from 'react';
import type { Invoice } from '@stellar-split/sdk';
import type { ExportFilterOptions } from '@/lib/invoiceExcelExport';
import { downloadExcel, generateExportFilename } from '@/lib/invoiceExcelExport';
import { apiFetch } from '@/lib/apiClient';

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

  // Filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
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

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const filters: ExportFilterOptions = {};

      if (startDate) {
        filters.startDate = new Date(startDate).getTime() / 1000;
      }
      if (endDate) {
        filters.endDate = new Date(endDate).getTime() / 1000;
      }
      if (selectedStatuses.length > 0) {
        filters.statuses = selectedStatuses;
      }
      if (selectedAssets.length > 0) {
        filters.assets = selectedAssets;
      }

      const response = await apiFetch('/api/invoices/export', {
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
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isExporting}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isExporting}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
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
