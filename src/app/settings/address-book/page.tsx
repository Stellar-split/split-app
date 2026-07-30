"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { truncateAddress } from "@stellar-split/sdk";
import { useI18n } from "@/components/I18nProvider";
import FocusTrap from "@/components/FocusTrap";
import { useAddressLabel } from "@/hooks/useAddressLabel";

export interface AddressBookContact {
  id: string;
  address: string;
  label: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function SettingsAddressBookPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [contacts, setContacts] = useState<AddressBookContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<AddressBookContact | null>(null);
  const [deleteConfirmContact, setDeleteConfirmContact] = useState<AddressBookContact | null>(null);

  const [formAddress, setFormAddress] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Hook for auto-label suggestion when adding contacts
  const { suggestedLabel } = useAddressLabel(formAddress);

  // Fetch contacts from server-side API
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/address-book");
      if (res.ok) {
        const data: AddressBookContact[] = await res.json();
        setContacts(data);
      }
    } catch {
      // ignore fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Pre-fill suggested label if empty when address is typed
  useEffect(() => {
    if (suggestedLabel && !formLabel.trim() && !editingContact) {
      setFormLabel(suggestedLabel);
    }
  }, [suggestedLabel, formLabel, editingContact]);

  // Alphabetical sorting by label
  const sortedAndFilteredContacts = useMemo(() => {
    const sorted = [...contacts].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );

    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const openAddModal = () => {
    setEditingContact(null);
    setFormAddress("");
    setFormLabel("");
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (contact: AddressBookContact) => {
    setEditingContact(contact);
    setFormAddress(contact.address);
    setFormLabel(contact.label);
    setFormError("");
    setShowModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const address = formAddress.trim();
    const label = formLabel.trim();

    if (!address) {
      setFormError("Recipient Stellar address is required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingContact) {
        // PUT update
        const res = await fetch("/api/settings/address-book", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingContact.id, address, label }),
        });

        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to update contact");
          return;
        }

        await fetchContacts();
        setShowModal(false);
      } else {
        // POST create
        const res = await fetch("/api/settings/address-book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, label }),
        });

        const data = await res.json();
        if (!res.ok) {
          // Rejects duplicates with 409 and user-facing error message
          setFormError(data.error || "Failed to add contact");
          return;
        }

        await fetchContacts();
        setShowModal(false);
      }
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contact: AddressBookContact) => {
    try {
      const res = await fetch(`/api/settings/address-book?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchContacts();
      }
    } catch {
      // ignore delete error
    } finally {
      setDeleteConfirmContact(null);
    }
  };

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      /* ignore clipboard error */
    }
  };

  const handleUseInInvoice = (address: string) => {
    router.push(`/invoice/new?address=${encodeURIComponent(address)}`);
  };

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Recipient Address Book</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your saved recipient Stellar addresses and smart labels
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="self-start sm:self-auto min-h-11 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md"
        >
          + Add Contact
        </button>
      </div>

      <div className="relative mb-6">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          placeholder="Search by label or Stellar address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-11 bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400" aria-live="polite">Loading address book contacts…</p>
        </div>
      ) : sortedAndFilteredContacts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">
            {searchQuery.trim() ? "No contacts match your search query." : "No saved contacts in your address book."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortedAndFilteredContacts.map((contact) => (
            <li
              key={contact.id || contact.address}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all hover:border-gray-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-100 truncate">
                      {contact.label}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-400 mt-1 truncate" title={contact.address}>
                    {contact.address}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(contact.address)}
                    className="min-h-9 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors"
                  >
                    {copiedAddress === contact.address ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleUseInInvoice(contact.address)}
                    className="min-h-9 px-3 py-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-medium transition-colors"
                  >
                    Use in Invoice
                  </button>
                  <button
                    onClick={() => openEditModal(contact)}
                    className="min-h-9 px-2.5 py-1.5 text-xs text-gray-400 hover:text-indigo-300 transition-colors"
                    aria-label={`Edit ${contact.label}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmContact(contact)}
                    className="min-h-9 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors"
                    aria-label={`Delete ${contact.label}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / Edit Contact Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <FocusTrap onClose={() => setShowModal(false)}>
            <div
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 id="contact-modal-title" className="text-lg font-semibold text-white">
                  {editingContact ? "Edit Contact" : "Add New Contact"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="modal-address" className="block text-sm font-medium text-gray-300 mb-1">
                    Stellar Address or Federation Name
                  </label>
                  <input
                    id="modal-address"
                    type="text"
                    placeholder="G... or user*domain.com"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    required
                    autoFocus
                    className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modal-label" className="block text-sm font-medium text-gray-300">
                      Label / Alias
                    </label>
                    {suggestedLabel && (
                      <span className="text-xs text-indigo-400">
                        ✦ Suggested: {suggestedLabel}
                      </span>
                    )}
                  </div>
                  <input
                    id="modal-label"
                    type="text"
                    placeholder="e.g. Alice Ops"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg p-2.5">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-11 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Save Contact"}
                  </button>
                </div>
              </form>
            </div>
          </FocusTrap>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirmContact(null)}
        >
          <FocusTrap onClose={() => setDeleteConfirmContact(null)}>
            <div
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-modal-title" className="text-lg font-semibold text-white mb-2">
                Confirm Deletion
              </h2>
              <p className="text-sm text-gray-300 mb-6">
                Are you sure you want to delete contact{" "}
                <span className="font-semibold text-white">&quot;{deleteConfirmContact.label}&quot;</span> (
                <span className="font-mono text-xs text-gray-400">
                  {truncateAddress(deleteConfirmContact.address)}
                </span>
                )? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmContact(null)}
                  className="min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmContact)}
                  className="min-h-11 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-colors"
                >
                  Delete Contact
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </main>
  );
}
