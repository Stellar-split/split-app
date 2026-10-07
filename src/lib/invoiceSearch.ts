import type { Invoice } from "@stellar-split/sdk";

export interface SearchResult {
  invoices: Invoice[];
  query: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters?: Record<string, unknown>;
  createdAt: number;
}

const RECENT_SEARCHES_KEY = "recentSearches";
const SAVED_SEARCHES_KEY = "savedSearches";
const MAX_RECENT = 10;
const MAX_SAVED = 20;

/**
 * Full-text search across invoice fields: id, creator, recipient addresses,
 * title, token, and status. Supports multi-word queries (all terms must match).
 */
export function searchInvoices(invoices: Invoice[], query: string): Invoice[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Split into tokens so "USDC alice" matches both token and address
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  return invoices.filter((inv) => {
    // Build a searchable corpus for the invoice
    const fields: string[] = [
      inv.id,
      inv.status,
      inv.creator,
      inv.data?.title ?? "",
      inv.data?.token ?? "",
      ...inv.recipients.map((r) => r.address),
    ].map((f) => f.toLowerCase());

    const corpus = fields.join(" ");

    // Every token must appear somewhere in the corpus (AND semantics)
    return tokens.every((token) => corpus.includes(token));
  });
}

// ── Recent search history ────────────────────────────────────────────────────

export function getStoredSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSearch(query: string): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const searches = getStoredSearches();
    const filtered = searches.filter((s) => s !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function removeRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const searches = getStoredSearches().filter((s) => s !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {}
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {}
}

// ── Saved searches (named, persistent) ──────────────────────────────────────

export function getSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SAVED_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as SavedSearch[]) : [];
  } catch {
    return [];
  }
}

export function saveNamedSearch(
  name: string,
  query: string,
  filters?: Record<string, unknown>
): SavedSearch {
  const entry: SavedSearch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || query.trim(),
    query: query.trim(),
    filters,
    createdAt: Date.now(),
  };
  try {
    const existing = getSavedSearches();
    const updated = [entry, ...existing].slice(0, MAX_SAVED);
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
  return entry;
}

export function removeSavedSearch(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getSavedSearches().filter((s) => s.id !== id);
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearSavedSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SAVED_SEARCHES_KEY);
  } catch {}
}
