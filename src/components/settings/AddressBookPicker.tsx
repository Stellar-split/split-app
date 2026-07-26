"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAddressLabel } from "@/hooks/useAddressLabel";
import { searchEntries, getAddressBook, type AddressEntry } from "@/lib/addressBook";

export interface AddressBookEntryItem {
  id?: string;
  address: string;
  label: string;
}

export interface AddressBookPickerProps {
  value: string;
  label?: string;
  onChange: (address: string, label?: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export default function AddressBookPicker({
  value,
  label = "",
  onChange,
  placeholder = "G... or name*domain.com",
  ariaLabel = "Recipient address",
  className = "",
}: AddressBookPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [serverEntries, setServerEntries] = useState<AddressBookEntryItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hook for smart label derivation
  const { suggestedLabel } = useAddressLabel(value);

  // Fetch server address book on mount and focus
  const fetchServerContacts = async () => {
    try {
      const res = await fetch("/api/settings/address-book");
      if (res.ok) {
        const data = await res.json();
        setServerEntries(data);
      }
    } catch {
      // Fallback to local entries if server fetch fails
    }
  };

  useEffect(() => {
    fetchServerContacts();
  }, []);

  // Merge server contacts and local address book entries
  const allEntries = useMemo(() => {
    const map = new Map<string, AddressBookEntryItem>();
    
    // Server entries first
    serverEntries.forEach((item) => {
      map.set(item.address.toLowerCase(), item);
    });

    // Local entries
    const local = getAddressBook();
    local.forEach((loc) => {
      if (!map.has(loc.address.toLowerCase())) {
        map.set(loc.address.toLowerCase(), {
          address: loc.address,
          label: loc.nickname,
        });
      }
    });

    return Array.from(map.values());
  }, [serverEntries]);

  // Autocomplete matching suggestions within 300 ms response time
  const suggestions = useMemo(() => {
    if (!value.trim()) {
      return allEntries.slice(0, 8);
    }

    const q = value.trim().toLowerCase();
    return allEntries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.address.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [value, allEntries]);

  // Pre-fill suggested label if address resolves and label not explicitly overridden
  useEffect(() => {
    if (suggestedLabel && value.trim() && !label) {
      onChange(value, suggestedLabel);
    }
  }, [suggestedLabel, value, label, onChange]);

  // Handle clicking outside to close combobox
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue, label);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  const handleSelect = (item: AddressBookEntryItem) => {
    onChange(item.address, item.label);
    setIsOpen(false);
  };

  const handleApplySuggestedLabel = () => {
    if (suggestedLabel) {
      onChange(value, suggestedLabel);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
      }
      return;
    }

    const totalCount = suggestions.length + (suggestedLabel ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % Math.max(1, totalCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + totalCount) % Math.max(1, totalCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
        handleSelect(suggestions[focusedIndex]);
      } else if (suggestedLabel && focusedIndex === suggestions.length) {
        handleApplySuggestedLabel();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            fetchServerContacts();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 min-h-11 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {label && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-900/60 text-indigo-200 text-xs px-2 py-0.5 rounded font-sans truncate max-w-[120px]">
            {label}
          </span>
        )}
      </div>

      {isOpen && (suggestions.length > 0 || suggestedLabel) && (
        <ul
          role="listbox"
          className="absolute z-30 w-full bg-gray-900 border border-gray-700 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-xl divide-y divide-gray-800"
        >
          {suggestions.map((item, idx) => (
            <li
              key={item.address + idx}
              role="option"
              aria-selected={focusedIndex === idx}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setFocusedIndex(idx)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                focusedIndex === idx ? "bg-indigo-600/30 text-indigo-100" : "hover:bg-gray-800 text-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-200 truncate">{item.label}</span>
                <span className="text-xs text-indigo-400 shrink-0 font-sans bg-indigo-950 px-1.5 py-0.5 rounded">
                  Saved Contact
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono truncate">{item.address}</p>
            </li>
          ))}

          {suggestedLabel && !suggestions.some((s) => s.label.toLowerCase() === suggestedLabel.toLowerCase()) && (
            <li
              role="option"
              aria-selected={focusedIndex === suggestions.length}
              onClick={handleApplySuggestedLabel}
              onMouseEnter={() => setFocusedIndex(suggestions.length)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                focusedIndex === suggestions.length
                  ? "bg-indigo-600/30 text-indigo-100"
                  : "hover:bg-gray-800 text-indigo-300"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span>✦ Suggested Label:</span>
                <span className="text-white underline">{suggestedLabel}</span>
              </div>
              <p className="text-xs text-gray-400">Click to attach smart label to this address</p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
