"use client";

import { useState, useRef } from "react";
import { parseRecipients, parseCSVRow, saveColumnMapping, loadColumnMapping, InvoiceFormFields, ColumnMapping, EXPECTED_COLUMNS } from "@/lib/csvInvoiceSchema";
import ColumnMappingModal from "./ColumnMappingModal";

interface CSVRowImporterProps {
  onImportComplete: (data: InvoiceFormFields & { recipients?: any[] }) => void;
}

export default function CSVRowImporter({ onImportComplete }: CSVRowImporterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<{ [key: string]: any } | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [currentMapping, setCurrentMapping] = useState<ColumnMapping | null>(null);
  const [spreadsheetName, setSpreadsheetName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParseCSVRow = (text: string): { columns: string[]; data: { [key: string]: string } } | null => {
    const parsed = parseCSVRow(text);
    if (!parsed) {
      setError("CSV must contain headers and at least one data row with matching column counts");
      return null;
    }
    return parsed;
  };

  const handlePasteCSV = () => {
    if (!csvInput.trim()) {
      setError("Please paste CSV content");
      return;
    }

    setError(null);
    const parsed = handleParseCSVRow(csvInput);
    if (!parsed) return;

    const { columns, data } = parsed;
    setCsvColumns(columns);
    setPendingCsvData(data);

    const detectedMapping = detectMapping(columns);
    if (needsMapping(columns)) {
      setShowMappingModal(true);
    } else {
      processImport(data, detectedMapping);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSpreadsheetName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension for localStorage key

    try {
      const text = await file.text();
      setCsvInput(text);

      const parsed = handleParseCSVRow(text);
      if (!parsed) return;

      const { columns, data } = parsed;
      setCsvColumns(columns);
      setPendingCsvData(data);

      const savedMapping = loadColumnMapping(file.name);
      if (savedMapping) {
        processImport(data, savedMapping);
      } else if (needsMapping(columns)) {
        setShowMappingModal(true);
      } else {
        processImport(data, detectMapping(columns));
      }
    } catch (err) {
      setError(`Failed to read file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const detectMapping = (columns: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    columns.forEach((col) => {
      const normalized = col.toLowerCase().trim();
      if (EXPECTED_COLUMNS.includes(normalized)) {
        mapping[col] = normalized as any;
      }
    });
    return mapping;
  };

  const needsMapping = (columns: string[]): boolean => {
    return !columns.every(
      (col) =>
        EXPECTED_COLUMNS.includes(col.toLowerCase().trim())
    );
  };

  const processImport = (data: { [key: string]: string }, mapping: ColumnMapping) => {
    const mapped: InvoiceFormFields & { recipients?: any[] } = {};
    let hasData = false;

    Object.entries(mapping).forEach(([csvCol, formField]) => {
      const value = data[csvCol];
      if (value && formField in data) {
        mapped[formField as keyof InvoiceFormFields] = value;
        hasData = true;
      }
    });

    if (mapped.recipients && typeof mapped.recipients === "string") {
      mapped.recipients = parseRecipients(mapped.recipients);
    }

    if (!hasData) {
      setError("No data found in CSV row");
      return;
    }

    if (spreadsheetName && currentMapping) {
      saveColumnMapping(spreadsheetName, currentMapping);
    }

    setCsvInput("");
    setIsExpanded(false);
    onImportComplete(mapped);
  };

  const handleMappingConfirm = (mapping: ColumnMapping) => {
    setCurrentMapping(mapping);
    setShowMappingModal(false);
    if (pendingCsvData) {
      processImport(pendingCsvData, mapping);
    }
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-700 hover:bg-blue-100"
      >
        {isExpanded ? "Hide CSV Import" : "Import from CSV Row"}
      </button>

      {isExpanded && (
        <div className="mt-4 p-4 border border-gray-200 rounded bg-gray-50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Paste CSV row with headers:
            </label>
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="title,amount,recipients&#10;Event Catering,1000,GAAAA:60|GBBBB:40"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <button
            onClick={handlePasteCSV}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600"
          >
            Import from Paste
          </button>

          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600"
            >
              Upload CSV File
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      <ColumnMappingModal
        isOpen={showMappingModal}
        csvColumns={csvColumns}
        onConfirm={handleMappingConfirm}
        onCancel={() => {
          setShowMappingModal(false);
          setPendingCsvData(null);
        }}
      />
    </div>
  );
}
