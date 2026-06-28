import type { Invoice } from "@stellar-split/sdk";

export interface SearchResult {
  invoices: Invoice[];
  query: string;
}

export function searchInvoices(invoices: Invoice[], query: string): Invoice[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  return invoices.filter((inv) => {
    const matches =
      inv.id.toLowerCase().includes(lowerQuery) ||
      inv.creator.toLowerCase().includes(lowerQuery) ||
      (inv.data?.title as string)?.toLowerCase().includes(lowerQuery) ||
      inv.recipients.some((r) =>
        r.address.toLowerCase().includes(lowerQuery)
      );
    return matches;
  });
}

export function getStoredSearches(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("recentSearches");
  return stored ? JSON.parse(stored) : [];
}

export function saveSearch(query: string): void {
  if (typeof window === "undefined") return;
  const searches = getStoredSearches();
  const filtered = searches.filter((s) => s !== query);
  const updated = [query, ...filtered].slice(0, 10);
  localStorage.setItem("recentSearches", JSON.stringify(updated));
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("recentSearches");
}
