"use client";

import { useState, useRef, useMemo } from "react";
import { searchEntries, addEntry, type AddressEntry } from "@/lib/addressBook";
import { searchAddressHistory, searchAmountHistory } from "@/lib/invoiceHistory";
import { searchRecipients, touchRecipient, type RecipientEntry } from "@/lib/recipients";
import { truncateAddress } from "@stellar-split/sdk";
import CsvRecipientImport from "@/components/CsvRecipientImport";

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

interface AddressSuggestion extends AddressEntry {
  count?: number;
  source?: "book" | "history";
}

/**
 * RecipientForm — dynamic add/remove rows for recipients and split amounts.
 * Address input auto-suggests saved addresses from the address book and invoice history.
 */
export default function RecipientForm({
  recipients,
  onChange,
  equalSplit = false,
  amountOverride,
}: Props) {
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [amountSuggestions, setAmountSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeField, setActiveField] = useState<"address" | "amount" | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const savedDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseRecipientFile = async (file: File): Promise<RecipientRow[]> => {
    const text = await file.text();
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "json") {
      const data = JSON.parse(text);
      return (Array.isArray(data) ? data : []).map((r: { address?: string; amount?: string }) => ({
        address: r.address ?? "",
        amount: r.amount ?? "",
      }));
    }
    // CSV
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const idx = (k: string) => header.indexOf(k);
      return {
        address: idx("address") >= 0 ? cols[idx("address")] ?? "" : cols[0] ?? "",
        amount: idx("amount") >= 0 ? cols[idx("amount")] ?? "" : cols[1] ?? "",
      };
    }).filter((r) => r.address);
  };

  const update = (index: number, field: keyof RecipientRow, value: string) => {
    const next = recipients.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange(next);
  };

  const addRow = () => onChange([...recipients, { address: "", amount: "" }]);

  const removeRow = (index: number) =>
    onChange(recipients.filter((_, i) => i !== index));

  const buildAddressSuggestions = (query: string) => {
    const book = query.trim().length >= 2 ? searchEntries(query.trim()) : [];
    const history = searchAddressHistory(query.trim());
    const merged = new Map<string, AddressSuggestion>();

    book.forEach((entry) => {
      merged.set(entry.address, { ...entry, source: "book" });
    });

    history.forEach((entry) => {
      const existing = merged.get(entry.address);
      if (existing) {
        merged.set(entry.address, {
          ...existing,
          count: entry.count,
          source: "book",
        });
      } else {
        merged.set(entry.address, {
          nickname: entry.address.slice(0, 8) + "…",
          address: entry.address,
          count: entry.count,
          source: "history",
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => {
      if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0);
      return a.nickname.localeCompare(b.nickname);
    });
  };

  const updateAmountSuggestions = (index: number, value: string) => {
    const address = recipients[index]?.address || undefined;
    const suggestions = searchAmountHistory(address, value.trim());
    setAmountSuggestions(suggestions);
    setActiveIndex(index);
    setActiveField("amount");
  };

  const handleAddressChange = (index: number, value: string) => {
    update(index, "address", value);
    setActiveIndex(index);
    setActiveField("address");
    setAddressSuggestions(buildAddressSuggestions(value));
    setAmountSuggestions([]);
    handleAddressSave(value);
  };

  const handleAmountChange = (index: number, value: string) => {
    update(index, "amount", value);
    updateAmountSuggestions(index, value);
  };

  const selectAddressSuggestion = (index: number, entry: AddressSuggestion) => {
    update(index, "address", entry.address);
    setAddressSuggestions([]);
    setActiveIndex(null);
    setActiveField(null);
  };

  const selectAmountSuggestion = (index: number, amount: string) => {
    update(index, "amount", amount);
    setAmountSuggestions([]);
    setActiveIndex(null);
    setActiveField(null);
  };

  const handleAddressBlur = () => {
    setTimeout(() => {
      setAddressSuggestions([]);
      setActiveIndex(null);
      setActiveField(null);
    }, 150);
  };

  const handleAmountFocus = (index: number) => {
    updateAmountSuggestions(index, recipients[index]?.amount ?? "");
  };

  // Save address to book when a valid G... address is entered
  const handleAddressSave = (address: string) => {
    if (address.startsWith("G") && address.length >= 56) {
      addEntry({ nickname: address.slice(0, 8) + "…", address });
    }
  };

  const savedRecipients = useMemo(() => searchRecipients(savedSearchQuery), [savedSearchQuery]);

  const handleAddFromSaved = (recipient: RecipientEntry) => {
    const emptyIndex = recipients.findIndex((r) => !r.address);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : recipients.length;
    if (emptyIndex >= 0) {
      update(targetIndex, "address", recipient.address);
    } else {
      onChange([...recipients, { address: recipient.address, amount: "" }]);
    }
    touchRecipient(recipient.address);
    setShowSavedDropdown(false);
    setSavedSearchQuery("");
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-mono"
            />
            {activeField === "address" && activeIndex === i && addressSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {addressSuggestions.map((entry) => (
                  <li key={entry.address}>
                    <button
                      type="button"
                      onMouseDown={() => selectAddressSuggestion(i, entry)}
                      className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-gray-700 font-mono truncate"
                    >
                      <div className="truncate">
                        {entry.nickname} — {entry.address}
                      </div>
                      {entry.source === "history" && entry.count ? (
                        <div className="text-xs text-gray-400">
                          Used {entry.count} time{entry.count > 1 ? "s" : ""}
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative w-full sm:w-28">
            <input
              type="number"
              placeholder="USDC"
              step="0.0000001"
              min="0.0000001"
              value={equalSplit ? (amountOverride ?? "") : row.amount}
              onChange={
                equalSplit ? undefined : (e) => handleAmountChange(i, e.target.value)
              }
              onFocus={() => !equalSplit && handleAmountFocus(i)}
              readOnly={equalSplit}
              required
              aria-label={`Recipient ${i + 1} amount`}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                equalSplit
                  ? "border-gray-600 text-gray-400 cursor-not-allowed"
                  : "border-gray-700"
              }`}
            />
            {activeField === "amount" && activeIndex === i && amountSuggestions.length > 0 && !equalSplit && (
              <ul className="absolute z-10 right-0 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {amountSuggestions.map((amount) => (
                  <li key={amount}>
                    <button
                      type="button"
                      onMouseDown={() => selectAmountSuggestion(i, amount)}
                      className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-gray-700 font-mono"
                    >
                      {amount} USDC
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {recipients.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove recipient ${i + 1}`}
              className="min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-red-700 text-sm transition-colors sm:self-start focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        + Add Recipient
      </button>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={() => setShowSavedDropdown((v) => !v)}
          className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
        >
          📌 Add from saved
        </button>
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

      {showSavedDropdown && (
        <div ref={savedDropdownRef} className="relative mt-2">
          <input
            type="search"
            placeholder="Search saved recipients..."
            value={savedSearchQuery}
            onChange={(e) => setSavedSearchQuery(e.target.value)}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {savedRecipients.length > 0 && (
            <ul className="absolute z-20 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto">
              {savedRecipients.map((r) => (
                <li key={r.address}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAddFromSaved(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-medium text-gray-200">{r.nickname}</span>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{truncateAddress(r.address)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {savedSearchQuery.trim() && savedRecipients.length === 0 && (
            <div className="absolute z-20 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 px-3 py-2 text-sm text-gray-500">
              No saved recipients match your search.
            </div>
          )}
        </div>
      )}

      {/* CSV import with full validation and preview */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
          Import CSV with validation
        </p>
        <CsvRecipientImport
          existingCount={recipients.length}
          onImport={(rows) => {
            onChange([...recipients, ...rows]);
          }}
        />
      </div>
    </div>
  );
}