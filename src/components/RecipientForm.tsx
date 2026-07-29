"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import AddressBookPicker from "@/components/settings/AddressBookPicker";
import { searchEntries, addEntry, getEmailForAddress, type AddressEntry } from "@/lib/addressBook";
import Avatar from "@/components/ui/Avatar";
import { searchAddressHistory, searchAmountHistory } from "@/lib/invoiceHistory";
import { searchRecipients, touchRecipient, type RecipientEntry } from "@/lib/recipients";
import { truncateAddress } from "@stellar-split/sdk";
import CsvRecipientImport from "@/components/CsvRecipientImport";
import { useEmailValidation } from "@/hooks/useEmailValidation";
import EmailField from "@/components/EmailField";

export interface RecipientRow {
  address: string;
  amount: string;
  label?: string;
  email?: string;
}

interface Props {
  recipients: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  equalSplit?: boolean;
  amountOverride?: string;
}

/**
 * RecipientForm — dynamic add/remove rows for recipients and split amounts.
 * Integrates AddressBookPicker with smart label support on /invoice/new.
 */
export default function RecipientForm({
  recipients,
  onChange,
  equalSplit = false,
  amountOverride,
}: Props) {
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
      return (Array.isArray(data) ? data : []).map((r: { address?: string; amount?: string; label?: string }) => ({
        address: r.address ?? "",
        amount: r.amount ?? "",
        label: r.label ?? "",
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
        label: idx("label") >= 0 ? cols[idx("label")] ?? "" : "",
      };
    }).filter((r) => r.address);
  };

  const updateRow = (index: number, address: string, label?: string, email?: string) => {
    const next = recipients.map((r, i) =>
      i === index ? { ...r, address, label: label !== undefined ? label : r.label, email: email !== undefined ? email : r.email } : r
    );
    onChange(next);
  };

  const updateAmount = (index: number, amount: string) => {
    const next = recipients.map((r, i) =>
      i === index ? { ...r, amount } : r
    );
    onChange(next);
  };

  const addRow = () => onChange([...recipients, { address: "", amount: "", label: "" }]);

  const removeRow = (index: number) =>
    onChange(recipients.filter((_, i) => i !== index));

  const updateAmountSuggestions = (index: number, value: string) => {
    const address = recipients[index]?.address || undefined;
    const suggestions = searchAmountHistory(address, value.trim());
    setAmountSuggestions(suggestions);
    setActiveIndex(index);
    setActiveField("amount");
  };

  const handleAmountChange = (index: number, value: string) => {
    updateAmount(index, value);
    updateAmountSuggestions(index, value);
  };

  const selectAmountSuggestion = (index: number, amount: string) => {
    updateAmount(index, amount);
    setAmountSuggestions([]);
    setActiveIndex(null);
    setActiveField(null);
  };

  const handleAmountFocus = (index: number) => {
    updateAmountSuggestions(index, recipients[index]?.amount ?? "");
  };

  const savedRecipients = useMemo(() => searchRecipients(savedSearchQuery), [savedSearchQuery]);

  // Contact emails come from localStorage, so they can only be resolved after
  // mount; the deterministic avatar renders identically on both passes.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const addressKey = recipients.map((r) => r.address).join("|");
  const emailByAddress = useMemo(() => {
    if (!mounted) return {} as Record<string, string | undefined>;
    const map: Record<string, string | undefined> = {};
    for (const address of addressKey.split("|")) {
      if (address && map[address] === undefined) {
        map[address] = getEmailForAddress(address);
      }
    }
    return map;
    // addressKey is the serialized dependency for `recipients`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey, mounted]);

  const handleAddFromSaved = (recipient: RecipientEntry) => {
    const emptyIndex = recipients.findIndex((r) => !r.address);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : recipients.length;
    if (emptyIndex >= 0) {
      updateRow(targetIndex, recipient.address, recipient.nickname);
    } else {
      onChange([...recipients, { address: recipient.address, amount: "", label: recipient.nickname }]);
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
        <div key={i} className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start min-w-0">
            <Avatar
              address={row.address}
              email={emailByAddress[row.address]}
              size={32}
              className="mt-1.5 hidden sm:inline-flex"
            />

            <div className="relative flex-1 min-w-0 w-full">
              <AddressBookPicker
                value={row.address}
                label={row.label}
                onChange={(address, label) => updateRow(i, address, label, row.email)}
                placeholder="G... or name*domain.com address"
                ariaLabel={`Recipient ${i + 1} address`}
              />
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
                className={`w-full bg-gray-800 border rounded-lg px-3 py-2 min-h-11 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  equalSplit
                    ? "border-gray-600 text-gray-400 cursor-not-allowed"
                    : "border-gray-700"
                }`}
              />
              {activeField === "amount" && activeIndex === i && amountSuggestions.length > 0 && !equalSplit && (
                <ul className="absolute z-10 right-0 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {amountSuggestions.map((amount) => (
                    <li key={amount}>
                      <button
                        type="button"
                        onMouseDown={() => selectAmountSuggestion(i, amount)}
                        className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-gray-700 font-mono text-gray-200"
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

          <div className="flex items-center gap-2 min-w-0 w-full">
            <div className="hidden sm:block w-8" />
            <div className="flex-1">
              <EmailField
                email={row.email || ""}
                onEmailChange={(email) => updateRow(i, row.address, row.label, email)}
                onBlur={() => {}}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        + Add Recipient
      </button>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={() => setShowSavedDropdown((v) => !v)}
          className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
        >
          📌 Add from saved
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
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
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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