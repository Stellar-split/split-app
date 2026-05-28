"use client";

import { useState, useRef } from "react";
import { searchEntries, addEntry, type AddressEntry } from "@/lib/addressBook";
import { parseRecipientFile } from "@/lib/bulkImporter";

interface RecipientRow {
  address: string;
  amount: string;
}

interface Props {
  recipients: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  equalSplit?: boolean;
  amountOverride?: string;
}

/**
 * RecipientForm — dynamic add/remove rows for recipients and split amounts.
 * Address input auto-suggests saved addresses from the address book.
 */
export default function RecipientForm({
  recipients,
  onChange,
  equalSplit = false,
  amountOverride,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (index: number, field: keyof RecipientRow, value: string) => {
    const next = recipients.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange(next);
  };

  const addRow = () => onChange([...recipients, { address: "", amount: "" }]);

  const removeRow = (index: number) =>
    onChange(recipients.filter((_, i) => i !== index));

  const handleAddressChange = (index: number, value: string) => {
    update(index, "address", value);
    setActiveIndex(index);
    if (value.trim().length >= 2) {
      setSuggestions(searchEntries(value.trim()));
    } else {
      setSuggestions([]);
    }
    handleAddressSave(value);
  };

  const selectSuggestion = (index: number, entry: AddressEntry) => {
    update(index, "address", entry.address);
    setSuggestions([]);
    setActiveIndex(null);
  };

  const handleAddressBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setSuggestions([]);
      setActiveIndex(null);
    }, 150);
  };

  // Save address to book when a valid G... address is entered
  const handleAddressSave = (address: string) => {
    if (address.startsWith("G") && address.length >= 56) {
      addEntry({ nickname: address.slice(0, 8) + "…", address });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    try {
      const imported = await parseRecipientFile(file);
      if (imported.length === 0) {
        setImportError("No valid recipients found in file");
        return;
      }
      onChange([...recipients, ...imported]);
    } catch (err) {
      setImportError(String(err));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {recipients.map((row, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start min-w-0">
          <div className="relative flex-1 min-w-0 w-full">
            <input
              type="text"
              placeholder="G... address"
              value={row.address}
              onChange={(e) => handleAddressChange(i, e.target.value)}
              onBlur={handleAddressBlur}
              required
              aria-label={`Recipient ${i + 1} address`}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {activeIndex === i && suggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {suggestions.map((entry) => (
                  <li key={entry.address}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(i, entry)}
                      className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-gray-700 font-mono truncate"
                    >
                      {entry.nickname} — {entry.address}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="number"
            placeholder="USDC"
            step="0.0000001"
            min="0.0000001"
            value={equalSplit ? (amountOverride ?? "") : row.amount}
            onChange={
              equalSplit ? undefined : (e) => update(i, "amount", e.target.value)
            }
            readOnly={equalSplit}
            required
            aria-label={`Recipient ${i + 1} amount`}
            className={`w-full sm:w-28 bg-gray-800 border rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              equalSplit
                ? "border-gray-600 text-gray-400 cursor-not-allowed"
                : "border-gray-700"
            }`}
          />
          {recipients.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove recipient ${i + 1}`}
              className="min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-red-700 text-sm transition-colors sm:self-start"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
      >
        + Add Recipient
      </button>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
        >
          📥 Import Recipients
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import recipients file"
        />
        {importError && (
          <p className="text-red-400 text-sm self-start">{importError}</p>
        )}
      </div>
    </div>
  );
}
