"use client";

import { useState, useMemo } from "react";
import { getAddressBook, AddressEntry } from "@/lib/addressBook";
import RecipientReputationBadge from "@/components/ReputationBadge";

interface SelectedContact extends AddressEntry {
  email?: string;
}

interface BulkInviteModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  onSubmit: (invitees: SelectedContact[]) => Promise<void>;
  onClose: () => void;
}

const MAX_INVITES = 50;

export default function BulkInviteModal({
  isOpen,
  groupId,
  groupName,
  onSubmit,
  onClose,
}: BulkInviteModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const addressBook = getAddressBook();

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return addressBook;

    const query = searchQuery.toLowerCase();
    return addressBook.filter(
      (contact) =>
        contact.nickname.toLowerCase().includes(query) ||
        contact.address.toLowerCase().startsWith(query)
    );
  }, [searchQuery, addressBook]);

  const isMaxSelected = selectedContacts.length >= MAX_INVITES;
  const canAddMore = selectedContacts.length < MAX_INVITES;

  const toggleContact = (contact: AddressEntry) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.some((c) => c.address === contact.address);
      if (isSelected) {
        return prev.filter((c) => c.address !== contact.address);
      } else if (canAddMore) {
        return [...prev, contact];
      }
      return prev;
    });
  };

  const removeContact = (address: string) => {
    setSelectedContacts((prev) =>
      prev.filter((c) => c.address !== address)
    );
  };

  const handleSubmit = async () => {
    if (selectedContacts.length === 0) {
      setError("Please select at least one contact to invite");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(selectedContacts);
      setSuccessMessage(
        `Successfully invited ${selectedContacts.length} contact${selectedContacts.length !== 1 ? "s" : ""} to ${groupName}`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        setSelectedContacts([]);
        setSearchQuery("");
        onClose();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send invitations"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Bulk Invite to {groupName}</h2>

        {/* Search Box */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Selected Contacts List */}
        {selectedContacts.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-xs font-medium text-blue-700 mb-2">
              Selected ({selectedContacts.length}/{MAX_INVITES})
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedContacts.map((contact) => (
                <div
                  key={contact.address}
                  className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-blue-300 text-xs"
                >
                  <span className="truncate">{contact.nickname}</span>
                  <button
                    onClick={() => removeContact(contact.address)}
                    className="text-blue-500 hover:text-blue-700 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Contacts */}
        <div className="border-t pt-3 mb-4 space-y-2 max-h-48 overflow-y-auto">
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => {
              const isSelected = selectedContacts.some(
                (c) => c.address === contact.address
              );
              return (
                <div
                  key={contact.address}
                  onClick={() => toggleContact(contact)}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                    isSelected
                      ? "bg-blue-100 border border-blue-300"
                      : "bg-gray-50 hover:bg-gray-100"
                  } ${!canAddMore && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleContact(contact);
                    }}
                    disabled={!canAddMore && !isSelected}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.nickname}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {contact.address}
                    </p>
                  </div>
                  <RecipientReputationBadge address={contact.address} />
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No contacts found
            </p>
          )}
        </div>

        {isMaxSelected && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-700">
              Maximum {MAX_INVITES} invites per action
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-xs text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedContacts.length === 0 || isSubmitting}
            className={`px-4 py-2 rounded text-sm font-medium ${
              selectedContacts.length === 0 || isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {isSubmitting ? "Sending..." : `Send Invitations (${selectedContacts.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
