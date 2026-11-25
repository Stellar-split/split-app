/**
 * invoiceHistory — localStorage-backed recipient history for StellarSplit.
 * Tracks frequently used addresses and amounts and exposes smart suggestions.
 */

export interface InvoiceHistoryEntry {
  address: string;
  amount: string;
  count: number;
  lastUsed: number;
}

const STORAGE_KEY = "stellarsplit_invoice_history";
const MAX_ENTRIES = 100;

function getInvoiceHistory(): InvoiceHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as InvoiceHistoryEntry[];
  } catch {
    return [];
  }
}

function saveInvoiceHistory(entries: InvoiceHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function recordInvoiceHistory(recipients: { address: string; amount: string }[]): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const history = getInvoiceHistory();
  const map = new Map<string, InvoiceHistoryEntry>(
    history.map((entry) => [`${entry.address}|${entry.amount}`, entry])
  );

  recipients.forEach(({ address, amount }) => {
    const trimmedAddress = address.trim();
    const trimmedAmount = amount.trim();
    if (!trimmedAddress.startsWith("G") || trimmedAddress.length < 56 || !trimmedAmount) {
      return;
    }

    const key = `${trimmedAddress}|${trimmedAmount}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = now;
    } else {
      map.set(key, {
        address: trimmedAddress,
        amount: trimmedAmount,
        count: 1,
        lastUsed: now,
      });
    }
  });

  const next = Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastUsed - a.lastUsed;
  });
  saveInvoiceHistory(next);
}

export interface AddressHistorySuggestion {
  address: string;
  count: number;
  lastUsed: number;
}

export function searchAddressHistory(query: string, limit = 6): AddressHistorySuggestion[] {
  const history = getInvoiceHistory();
  const byAddress = new Map<string, AddressHistorySuggestion>();
  const normalized = query.trim().toLowerCase();

  history.forEach((entry) => {
    const existing = byAddress.get(entry.address);
    if (existing) {
      existing.count += entry.count;
      existing.lastUsed = Math.max(existing.lastUsed, entry.lastUsed);
    } else {
      byAddress.set(entry.address, {
        address: entry.address,
        count: entry.count,
        lastUsed: entry.lastUsed,
      });
    }
  });

  return Array.from(byAddress.values())
    .filter((item) =>
      normalized === "" ? true : item.address.toLowerCase().includes(normalized)
    )
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastUsed - a.lastUsed;
    })
    .slice(0, limit);
}

export function searchAmountHistory(address: string | undefined, query: string, limit = 6): string[] {
  const history = getInvoiceHistory();
  const normalized = query.trim().toLowerCase();
  const byAmount = new Map<string, { count: number; lastUsed: number }>();

  history.forEach((entry) => {
    if (address && entry.address !== address) return;
    const existing = byAmount.get(entry.amount);
    if (existing) {
      existing.count += entry.count;
      existing.lastUsed = Math.max(existing.lastUsed, entry.lastUsed);
    } else {
      byAmount.set(entry.amount, {
        count: entry.count,
        lastUsed: entry.lastUsed,
      });
    }
  });

  return Array.from(byAmount.entries())
    .filter(([amount]) =>
      normalized === ""
        ? true
        : amount.toLowerCase().startsWith(normalized) || amount.toLowerCase().includes(normalized)
    )
    .sort(([, a], [, b]) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastUsed - a.lastUsed;
    })
    .slice(0, limit)
    .map(([amount]) => amount);
}
