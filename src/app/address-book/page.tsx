"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { truncateAddress } from "@stellar-split/sdk";
import { useI18n } from "@/components/I18nProvider";
import {
  getAddressBook,
  addEntry,
  updateEntry,
  removeEntry,
  isValidStellarPublicKey,
  type AddressEntry,
} from "@/lib/addressBook";
import FocusTrap from "@/components/FocusTrap";

export default function AddressBookPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [entries, setEntries] = useState<AddressEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formNickname, setFormNickname] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formError, setFormError] = useState("");

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getAddressBook());
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.nickname.toLowerCase().includes(q) ||
        e.address.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormNickname("");
    setFormAddress("");
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (entry: AddressEntry) => {
    setEditingAddress(entry.address);
    setFormNickname(entry.nickname);
    setFormAddress(entry.address);
    setFormError("");
    setShowModal(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const nickname = formNickname.trim();
    const address = formAddress.trim();

    if (!nickname || !address) {
      setFormError("Both fields are required");
      return;
    }

    if (!isValidStellarPublicKey(address)) {
      setFormError(t("addressBook.invalidAddress"));
      return;
    }

    if (editingAddress) {
      if (address !== editingAddress && entries.some((e) => e.address === address)) {
        setFormError("An entry with this address already exists");
        return;
      }
      const updated = updateEntry(editingAddress, { nickname, address });
      setEntries(updated);
    } else {
      if (entries.some((e) => e.address === address)) {
        setFormError("An entry with this address already exists");
        return;
      }
      const updated = addEntry({ nickname, address });
      setEntries(updated);
    }

    setShowModal(false);
  };

  const handleDelete = (address: string) => {
    setEntries(removeEntry(address));
    setDeleteConfirm(null);
  };

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleUseInInvoice = (address: string) => {
    router.push(`/invoice/new?address=${encodeURIComponent(address)}`);
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t("addressBook.title")}</h1>
        <button
          onClick={openAddModal}
          disabled={entries.length >= 50}
          className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {entries.length >= 50 ? t("addressBook.limitReached") : t("addressBook.addContact")}
        </button>
      </div>

      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          placeholder={t("addressBook.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">
          {searchQuery.trim() ? t("addressBook.noSearchResults") : t("addressBook.noSaved")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <li
              key={entry.address}
              className="bg-gray-900 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-200 truncate">{entry.nickname}</p>
                <button
                  onClick={() => handleCopy(entry.address)}
                  className="shrink-0 min-h-9 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {copiedAddress === entry.address ? t("addressBook.copied") : t("addressBook.copy")}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400 font-mono truncate" title={entry.address}>
                  {truncateAddress(entry.address)}
                </p>
                <button
                  onClick={() => handleUseInInvoice(entry.address)}
                  className="shrink-0 min-h-9 px-3 py-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("addressBook.useInInvoice")}
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-gray-800">
                <button
                  onClick={() => openEditModal(entry)}
                  className="text-xs text-gray-400 hover:text-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("addressBook.edit")}
                </button>
                <button
                  onClick={() => setDeleteConfirm(entry.address)}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("addressBook.remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <FocusTrap onClose={() => setShowModal(false)}>
            <div
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="contact-modal-title" className="text-lg font-semibold">
                  {editingAddress ? t("addressBook.editContactTitle") : t("addressBook.addContactTitle")}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="contact-nickname" className="block text-sm font-medium text-gray-300 mb-1">
                    {t("addressBook.nickname")}
                  </label>
                  <input
                    id="contact-nickname"
                    type="text"
                    value={formNickname}
                    onChange={(e) => setFormNickname(e.target.value)}
                    required
                    autoFocus
                    className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="contact-address" className="block text-sm font-medium text-gray-300 mb-1">
                    {t("addressBook.stellarAddress")}
                  </label>
                  <input
                    id="contact-address"
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    required
                    className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-red-400 text-sm">{formError}</p>
                )}

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {t("dashboard.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {t("addressBook.save")}
                  </button>
                </div>
              </form>
            </div>
          </FocusTrap>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <FocusTrap onClose={() => setDeleteConfirm(null)}>
            <div
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-modal-title" className="text-lg font-semibold mb-2">
                {t("addressBook.deleteContact")}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                {t("addressBook.confirmDelete").replace("{name}", entries.find((e) => e.address === deleteConfirm)?.nickname ?? "")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("dashboard.cancel")}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="min-h-11 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("addressBook.deleteContact")}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </main>
  );
}
