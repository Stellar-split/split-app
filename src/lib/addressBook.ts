/**
 * addressBook — localStorage-backed address book for StellarSplit.
 * Stores up to 50 entries as { nickname, address }[].
 */

export interface AddressEntry {
  nickname: string;
  address: string;
}

const STORAGE_KEY = "split-contacts";
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

export function exportToCSV(): string {
  const entries = getAddressBook();
  const rows = [["nickname", "address"].join(",")];
  for (const e of entries) {
    rows.push([`"${e.nickname.replace(/"/g, '""')}"`, `"${e.address}"`].join(","));
  }
  return rows.join("\n");
}

export function importFromCSV(csv: string): { imported: number; skipped: number } {
  const lines = csv.split("\n").filter(l => l.trim());
  const entries = getAddressBook();
  let imported = 0, skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i]!.match(/"([^"]*)","([^"]*)"/) || lines[i]!.split(",");
    const nickname = match[1]?.replace(/""/g, '"') || "";
    const address = match[2]?.trim() || "";
    if (!address || address.length !== 56) {
      skipped++;
      continue;
    }
    if (!entries.some(e => e.address === address)) {
      entries.push({ nickname, address });
      imported++;
    }
  }
  saveAddressBook(entries.slice(0, MAX_ENTRIES));
  return { imported, skipped };
}

export function exportToVCard(): string {
  return getAddressBook()
    .map(e => `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${e.nickname}\r\nX-STELLAR-ADDRESS:${e.address}\r\nEND:VCARD`)
    .join("\r\n\r\n");
}

export function importFromVCard(vcard: string): { imported: number; skipped: number } {
  const entries = getAddressBook();
  let imported = 0, skipped = 0;
  const vcards = vcard.split("BEGIN:VCARD").slice(1);
  for (const card of vcards) {
    const nickname = card.match(/FN:(.+)/)?.[1]?.trim() || "";
    const address = card.match(/X-STELLAR-ADDRESS:(.+)/)?.[1]?.trim() || "";
    if (!address || address.length !== 56) {
      skipped++;
      continue;
    }
    if (!entries.some(e => e.address === address)) {
      entries.push({ nickname, address });
      imported++;
    }
  }
  saveAddressBook(entries.slice(0, MAX_ENTRIES));
  return { imported, skipped };
}

export function downloadCSV(): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([exportToCSV()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `address-book-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates a Stellar public key (G... address).
 * Stellar addresses are 56-character base32 strings starting with 'G'.
 */
export function isValidStellarPublicKey(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export function downloadVCard(): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([exportToVCard()], { type: "text/vcard" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `address-book-${Date.now()}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
