/**
 * recipients — localStorage-backed saved recipients for StellarSplit invoices.
 * Stores up to 50 entries as { nickname, address, lastUsed }[] under the
 * `split-recipients` key.
 */

export interface RecipientEntry {
  nickname: string;
  address: string;
  lastUsed?: number;
}

const STORAGE_KEY = "split-recipients";
const MAX_ENTRIES = 50;

export function getRecipients(): RecipientEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecipients(entries: RecipientEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addRecipient(entry: Omit<RecipientEntry, "lastUsed">): RecipientEntry[] {
  const entries = getRecipients().filter((e) => e.address !== entry.address);
  const updated = [{ ...entry, lastUsed: Date.now() }, ...entries].slice(0, MAX_ENTRIES);
  saveRecipients(updated);
  return updated;
}

export function updateRecipient(address: string, patch: Partial<RecipientEntry>): RecipientEntry[] {
  const updated = getRecipients().map((e) =>
    e.address === address ? { ...e, ...patch } : e
  );
  saveRecipients(updated);
  return updated;
}

export function touchRecipient(address: string): RecipientEntry[] {
  const updated = getRecipients().map((e) =>
    e.address === address ? { ...e, lastUsed: Date.now() } : e
  );
  saveRecipients(updated);
  return updated;
}

export function removeRecipient(address: string): RecipientEntry[] {
  const updated = getRecipients().filter((e) => e.address !== address);
  saveRecipients(updated);
  return updated;
}

export function searchRecipients(query: string): RecipientEntry[] {
  const q = query.toLowerCase();
  return getRecipients().filter(
    (e) =>
      e.nickname.toLowerCase().includes(q) ||
      e.address.toLowerCase().startsWith(q)
  );
}

export function isValidStellarPublicKey(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
