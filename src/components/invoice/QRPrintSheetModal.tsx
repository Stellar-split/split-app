"use client";

import { useState, useRef } from "react";
import { formatAmount } from "@stellar-split/sdk";
import { QRPrintSheet } from "./QRPrintSheet";

interface Invoice {
  id: string;
  title: string;
  amount: bigint;
  description?: string;
}

interface QRPrintSheetModalProps {
  isOpen: boolean;
  invoices: Invoice[];
  onClose: () => void;
}

const GRID_LAYOUTS = [
  { value: "2x2" as const, label: "2×2 (4 codes)", codes: 4 },
  { value: "3x3" as const, label: "3×3 (9 codes)", codes: 9 },
  { value: "2x6" as const, label: "2×6 (12 codes)", codes: 12 },
];

export default function QRPrintSheetModal({
  isOpen,
  invoices,
  onClose,
}: QRPrintSheetModalProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [gridLayout, setGridLayout] = useState<"2x2" | "3x3" | "2x6">("3x3");
  const [showLabels, setShowLabels] = useState(true);
  const [preview, setPreview] = useState(false);
  const printSheetRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const currentLayout = GRID_LAYOUTS.find((l) => l.value === gridLayout);
  const maxCodes = currentLayout?.codes || 12;
  const isMaxSelected = selectedInvoices.length >= maxCodes;

  const selectedInvoiceData = invoices.filter((inv) =>
    selectedInvoices.includes(inv.id)
  );

  const handlePrint = () => {
    if (printSheetRef.current) {
      const printWindow = window.open("", "", "height=500,width=500");
      if (printWindow) {
        printWindow.document.write(printSheetRef.current.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Print QR Sheet</h2>

        {!preview ? (
          <div className="space-y-4">
            {/* Grid Layout Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grid Layout
              </label>
              <div className="flex gap-3">
                {GRID_LAYOUTS.map((layout) => (
                  <button
                    key={layout.value}
                    onClick={() => setGridLayout(layout.value)}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      gridLayout === layout.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Labels Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show-labels"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="show-labels" className="text-sm font-medium">
                Show invoice title and amount labels
              </label>
            </div>

            {/* Invoice Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Invoices ({selectedInvoices.length}/{maxCodes})
              </label>

              {isMaxSelected && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-700">
                    Maximum {maxCodes} invoices for this layout
                  </p>
                </div>
              )}

              <div className="border rounded bg-gray-50 p-3 space-y-2 max-h-48 overflow-y-auto">
                {invoices.length > 0 ? (
                  invoices.map((invoice) => {
                    const isSelected = selectedInvoices.includes(invoice.id);
                    const canSelect = !isMaxSelected || isSelected;

                    return (
                      <label
                        key={invoice.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                          canSelect
                            ? "hover:bg-white"
                            : "opacity-50 cursor-not-allowed"
                        } ${isSelected ? "bg-blue-100 border border-blue-300" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleInvoice(invoice.id)}
                          disabled={!canSelect}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {invoice.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatAmount(invoice.amount)} USDC
                          </p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No invoices available
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setPreview(true)}
                disabled={selectedInvoices.length === 0}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  selectedInvoices.length === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Preview & Print
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Print Preview */}
            <div className="border rounded bg-gray-100 p-4 max-h-64 overflow-auto">
              <QRPrintSheet
                ref={printSheetRef}
                invoices={selectedInvoiceData}
                gridLayout={gridLayout}
                showLabels={showLabels}
              />
            </div>

            {/* Print Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => setPreview(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
              >
                Print Sheet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
