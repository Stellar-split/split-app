"use client";

import useSWRInfinite from "swr/infinite";
import type { Invoice } from "@stellar-split/sdk";

interface InvoicePage {
  invoices: Invoice[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

async function fetchPage(url: string): Promise<InvoicePage> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch invoices: ${res.status} ${text}`);
  }
  return res.json() as Promise<InvoicePage>;
}

/**
 * Cursor-paginated invoice fetcher backed by SWR Infinite.
 *
 * @param publicKey - The wallet address to filter invoices for.
 *                    Pass null/undefined to skip fetching.
 */
export function useInfiniteInvoices(publicKey: string | null | undefined) {
  const getKey = (pageIndex: number, previousPage: InvoicePage | null) => {
    // Don't fetch without a public key
    if (!publicKey) return null;

    // First page — no cursor
    if (pageIndex === 0) {
      return `/api/invoices?publicKey=${encodeURIComponent(publicKey)}&limit=${PAGE_SIZE}`;
    }

    // No more pages
    if (previousPage?.nextCursor == null) return null;

    return `/api/invoices?publicKey=${encodeURIComponent(publicKey)}&cursor=${encodeURIComponent(previousPage.nextCursor)}&limit=${PAGE_SIZE}`;
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<InvoicePage>(getKey, fetchPage, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      persistSize: true,
    });

  // Flatten all pages into a single array
  const invoices: Invoice[] = data ? data.flatMap((page) => page.invoices) : [];

  // The last page tells us whether there is a next cursor
  const lastPage = data ? data[data.length - 1] : null;
  const hasMore = lastPage?.nextCursor != null;

  const loadMore = () => {
    if (!isValidating && hasMore) {
      setSize((s) => s + 1);
    }
  };

  return {
    invoices,
    isLoading,
    /** True while a page is being fetched (initial or subsequent) */
    isFetchingMore: isValidating,
    hasMore,
    loadMore,
    error,
    mutate,
  };
}
