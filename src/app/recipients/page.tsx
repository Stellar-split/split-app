"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { truncateAddress } from "@stellar-split/sdk";
import { useI18n } from "@/components/I18nProvider";
import {
  getRecipients,
  addRecipient,
  updateRecipient,
  removeRecipient,
  isValidStellarPublicKey,
  type RecipientEntry,
} from "@/lib/recipients";
import FocusTrap from "@/components/FocusTrap";

export default function RecipientsPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [entries, setEntries] = useState<RecipientEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getRecipients());
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.nickname.toLowerCase().includes(q) ||
        e.address.toLowerCase().startsWith(q)
    );
  }, [entries, searchQuery]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormName("");
    setFormAddress("");
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (entry: RecipientEntry) => {
    setEditingAddress(entry.address);
    setFormName(entry.nickname);
    setFormAddress(entry.address);
    setFormError("");
    setShowModal(true);
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const name = formName.trim();
    const address = formAddress.trim();

    if (!name || !address) {
      setFormError("Both fields are required");
      return;
    }

    if (!isValidStellarPublicKey(address)) {
      setFormError(t("recipients.invalidAddress"));
      return;
    }

    if (editingAddress) {
      if (address !== editingAddress && entries.some((e) => e.address === address)) {
        setFormError("An entry with this address already exists");
        return;
      }
      const updated = updateRecipient(editingAddress, { nickname: name, address });
      setEntries(updated);
    } else {
      if (entries.some((e) => e.address === address)) {
        setFormError("An entry with this address already exists");
        return;
      }
      const updated = addRecipient({ nickname: name, address });
      setEntries(updated);
    }

    setShowModal(false);
  };

  const handleDelete = (address: string) => {
    setEntries(removeRecipient(address));
    setDeleteConfirm(null);
  };

  const handleUseInInvoice = (address: string) => {
    router.push(`/invoice/new?address=${encodeURIComponent(address)}`);
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t("recipients.title")}</h1>
        <button
          onClick={openAddModal}
          disabled={entries.length >= 50}
          className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {entries.length >= 50 ? t("recipients.limitReached") : t("recipients.addRecipient")}
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
          placeholder={t("recipients.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">
          {searchQuery.trim() ? t("recipients.noSearchResults") : t("recipients.noSaved")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">{t("recipients.name")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("recipients.address")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("recipients.lastUsed")}</th>
                <th className="text-right px-4 py-3 font-medium">{t("recipients.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.map((entry) => (
                <tr key={entry.address} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{entry.nickname}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 truncate max-w-[200px]" title={entry.address}>
                    {truncateAddress(entry.address)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(entry.lastUsed)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleUseInInvoice(entry.address)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => openEditModal(entry)}
                        className="text-xs text-gray-400 hover:text-indigo-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      >
                        {t("recipients.edit")}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(entry.address)}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      >
                        {t("recipients.remove")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipient-modal-title"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <FocusTrap onClose={() => setShowModal(false)}>
            <div
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="recipient-modal-title" className="text-lg font-semibold text-indigo-400">
                  {editingAddress ? t("recipients.editRecipientTitle") : t("recipients.addRecipientTitle")}
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
                  <label htmlFor="recipient-name" className="block text-sm font-medium text-gray-300 mb-1">
                    {t("recipients.name")}
                  </label>
                  <input
                    id="recipient-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    autoFocus
                    className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="recipient-address" className="block text-sm font-medium text-gray-300 mb-1">
                    {t("recipients.address")}
                  </label>
                  <input
                    id="recipient-address"
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
                    {t("recipients.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {t("recipients.save")}
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
          aria-labelledby="delete-recipient-modal-title"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <FocusTrap onClose={() => setDeleteConfirm(null)}>
            <div
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-recipient-modal-title" className="text-lg font-semibold mb-2 text-red-400">
                {t("recipients.deleteRecipient")}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                {t("recipients.confirmDelete").replace("{name}", entries.find((e) => e.address === deleteConfirm)?.nickname ?? "")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("recipients.cancel")}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="min-h-11 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {t("recipients.deleteRecipient")}
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </main>
  );
}
