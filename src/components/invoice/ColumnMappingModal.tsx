"use client";

import { useState } from "react";
import { InvoiceFormFields, EXPECTED_COLUMNS, ColumnMapping } from "@/lib/csvInvoiceSchema";

interface ColumnMappingModalProps {
  isOpen: boolean;
  csvColumns: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export default function ColumnMappingModal({
  isOpen,
  csvColumns,
  onConfirm,
  onCancel,
}: ColumnMappingModalProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    const initial: ColumnMapping = {};
    csvColumns.forEach((col) => {
      const normalized = col.toLowerCase().trim();
      if (EXPECTED_COLUMNS.includes(normalized)) {
        initial[col] = normalized as keyof InvoiceFormFields;
      }
    });
    return initial;
  });

  if (!isOpen) return null;

  const handleMappingChange = (
    csvColumn: string,
    formField: keyof InvoiceFormFields | ""
  ) => {
    const newMapping = { ...mapping };
    if (formField === "") {
      delete newMapping[csvColumn];
    } else {
      newMapping[csvColumn] = formField;
    }
    setMapping(newMapping);
  };

  const handleConfirm = () => {
    onConfirm(mapping);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Map CSV Columns</h2>
        <p className="text-sm text-gray-600 mb-4">
          Match your CSV columns to the invoice form fields:
        </p>

        <div className="space-y-3 mb-6">
          {csvColumns.map((csvColumn) => (
            <div key={csvColumn} className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700">
                {csvColumn}
              </label>
              <select
                value={mapping[csvColumn] || ""}
                onChange={(e) =>
                  handleMappingChange(
                    csvColumn,
                    e.target.value as keyof InvoiceFormFields
                  )
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Skip this column</option>
                {EXPECTED_COLUMNS.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
          >
            Apply Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
