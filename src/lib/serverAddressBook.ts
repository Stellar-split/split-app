/**
 * Server-side address book store for StellarSplit persistence.
 * Stores contacts per user with address, label, and metadata.
 */

export interface AddressBookContact {
  id: string;
  address: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

// Initial mock contacts stored server-side
const initialContacts: AddressBookContact[] = [
  {
    id: "contact-1",
    address: "GAG3...ALICE1234567890123456789012345678901234567890123",
    label: "Alice Developer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "contact-2",
    address: "GBOB...BOB987654321098765432109876543210987654321098765",
    label: "Bob Operations",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// In-memory store per server process session
let contactsStore: AddressBookContact[] = [...initialContacts];

/**
 * Returns all saved address book contacts sorted alphabetically by label.
 */
export function getServerAddressBook(): AddressBookContact[] {
  return [...contactsStore].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

/**
 * Adds a new contact to the server address book.
 * Rejects duplicate addresses with 409 status error.
 */
export function addServerAddressBookEntry(entry: {
  address: string;
  label?: string;
}): { data?: AddressBookContact; error?: string; status: number } {
  const trimmedAddress = entry.address.trim();
  const trimmedLabel = (entry.label || "").trim() || `Contact (${trimmedAddress.slice(0, 6)}…)`;

  // Prevent duplicate address (case-insensitive)
  const isDuplicate = contactsStore.some(
    (c) => c.address.toLowerCase() === trimmedAddress.toLowerCase()
  );

  if (isDuplicate) {
    return {
      error: "Duplicate address: This address already exists in your address book.",
      status: 409,
    };
  }

  const newContact: AddressBookContact = {
    id: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    address: trimmedAddress,
    label: trimmedLabel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  contactsStore.unshift(newContact);
  return { data: newContact, status: 201 };
}

/**
 * Updates an existing contact label or address.
 */
export function updateServerAddressBookEntry(
  idOrAddress: string,
  patch: { address?: string; label?: string }
): { data?: AddressBookContact; error?: string; status: number } {
  const index = contactsStore.findIndex(
    (c) => c.id === idOrAddress || c.address.toLowerCase() === idOrAddress.toLowerCase()
  );

  if (index === -1) {
    return { error: "Contact not found", status: 404 };
  }

  const existing = contactsStore[index];
  const newAddress = patch.address ? patch.address.trim() : existing.address;

  // If changing address, check if new address collides with another contact
  if (newAddress.toLowerCase() !== existing.address.toLowerCase()) {
    const isDuplicate = contactsStore.some(
      (c) => c.id !== existing.id && c.address.toLowerCase() === newAddress.toLowerCase()
    );
    if (isDuplicate) {
      return {
        error: "Duplicate address: This address already exists in your address book.",
        status: 409,
      };
    }
  }

  const updated: AddressBookContact = {
    ...existing,
    address: newAddress,
    label: patch.label !== undefined ? patch.label.trim() : existing.label,
    updatedAt: new Date().toISOString(),
  };

  contactsStore[index] = updated;
  return { data: updated, status: 200 };
}

/**
 * Deletes a contact by ID or address.
 */
export function deleteServerAddressBookEntry(idOrAddress: string): boolean {
  const initialLength = contactsStore.length;
  contactsStore = contactsStore.filter(
    (c) => c.id !== idOrAddress && c.address.toLowerCase() !== idOrAddress.toLowerCase()
  );
  return contactsStore.length < initialLength;
}

/**
 * Resets the in-memory store (useful for testing).
 */
export function resetServerAddressBook(initial: AddressBookContact[] = initialContacts): void {
  contactsStore = [...initial];
}
