"use client";

import { useEffect, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";
import {
  getAddressBook,
  addEntry,
  updateEntry,
  removeEntry,
  type AddressEntry,
} from "@/lib/addressBook";

/**
 * Address Book page — manage saved Stellar addresses with nicknames.
 */
export default function AddressBookPage() {
  const [entries, setEntries] = useState<AddressEntry[]>([]);
  const [nickname, setNickname] = useState("");
  const [address, setAddress] = useState("");
  const [editAddress, setEditAddress] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");

  useEffect(() => {
    setEntries(getAddressBook());
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !address.trim()) return;
    const updated = addEntry({ nickname: nickname.trim(), address: address.trim() });
    setEntries(updated);
    setNickname("");
    setAddress("");
  };

  const handleEdit = (addr: string) => {
    const entry = entries.find((e) => e.address === addr);
    if (!entry) return;
    setEditAddress(addr);
    setEditNickname(entry.nickname);
  };

  const handleSaveEdit = (addr: string) => {
    const updated = updateEntry(addr, { nickname: editNickname.trim() });
    setEntries(updated);
    setEditAddress(null);
  };

  const handleRemove = (addr: string) => {
    setEntries(removeEntry(addr));
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-8">Address Book</h1>

      {/* Add new entry */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-10">
        <h2 className="text-lg font-semibold">Add Address</h2>
        <input
          type="text"
          placeholder="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="G... Stellar address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          className="min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={entries.length >= 50}
          className="self-start min-h-11 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {entries.length >= 50 ? "Limit reached (50)" : "Save Address"}
        </button>
      </form>

      {/* Saved entries */}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No saved addresses yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.address}
              className="flex flex-wrap items-center gap-3 bg-gray-900 rounded-lg px-4 py-3 min-w-0"
            >
              {editAddress === entry.address ? (
                <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0 w-full">
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(entry.address)}
                    className="min-h-11 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditAddress(null)}
                    className="min-h-11 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200">{entry.nickname}</p>
                    <p className="text-xs text-gray-400 font-mono truncate" title={entry.address}>
                      <span className="sm:hidden">{truncateAddress(entry.address)}</span>
                      <span className="hidden sm:inline">{entry.address}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(entry.address)}
                    aria-label={`Edit ${entry.nickname}`}
                    className="min-h-11 px-2 text-xs text-gray-400 hover:text-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(entry.address)}
                    aria-label={`Remove ${entry.nickname}`}
                    className="min-h-11 px-2 text-xs text-gray-400 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
