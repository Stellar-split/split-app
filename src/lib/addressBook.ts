/**
 * addressBook — localStorage-backed address book for StellarSplit.
 * Stores up to 50 entries as { nickname, address }[].
 */

export interface AddressEntry {
  nickname: string;
  address: string;
}

const STORAGE_KEY = "stellarsplit_address_book";
const MAX_ENTRIES = 50;

export function getAddressBook(): AddressEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveAddressBook(entries: AddressEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addEntry(entry: AddressEntry): AddressEntry[] {
  const entries = getAddressBook().filter((e) => e.address !== entry.address);
  const updated = [entry, ...entries].slice(0, MAX_ENTRIES);
  saveAddressBook(updated);
  return updated;
}

export function updateEntry(address: string, patch: Partial<AddressEntry>): AddressEntry[] {
  const updated = getAddressBook().map((e) =>
    e.address === address ? { ...e, ...patch } : e
  );
  saveAddressBook(updated);
  return updated;
}

export function removeEntry(address: string): AddressEntry[] {
  const updated = getAddressBook().filter((e) => e.address !== address);
  saveAddressBook(updated);
  return updated;
}

/** Return entries whose nickname or address starts with the query (case-insensitive). */
export function searchEntries(query: string): AddressEntry[] {
  const q = query.toLowerCase();
  return getAddressBook().filter(
    (e) =>
      e.nickname.toLowerCase().includes(q) ||
      e.address.toLowerCase().startsWith(q)
  );
}
