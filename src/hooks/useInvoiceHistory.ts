import { useState, useCallback } from "react";
import type { Invoice } from "@stellar-split/sdk";

interface HistoryPage {
  payments: Array<{
    payer: string;
    amount: bigint;
    timestamp?: number;
  }>;
  cursor: string | null;
}

export function useInvoiceHistory(invoiceId: string, limit = 10) {
  const [pages, setPages] = useState<HistoryPage[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        params.set("limit", String(limit));

        const res = await fetch(`/api/invoices/${invoiceId}/history?${params}`);
        if (!res.ok) throw new Error("Failed to fetch history");

        const data = await res.json();
        return {
          payments: data.payments || [],
          cursor: data.nextCursor || null,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [invoiceId, limit]
  );

  const goToNextPage = useCallback(async () => {
    const currentPage = pages[currentPageIdx];
    if (!currentPage || !currentPage.cursor) return;

    const nextPage = await loadPage(currentPage.cursor);
    if (nextPage) {
      setPages((prev) => [...prev, nextPage]);
      setCurrentPageIdx((prev) => prev + 1);
    }
  }, [pages, currentPageIdx, loadPage]);

  const goToPreviousPage = useCallback(() => {
    if (currentPageIdx > 0) {
      setCurrentPageIdx((prev) => prev - 1);
    }
  }, [currentPageIdx]);

  const loadFirstPage = useCallback(async () => {
    const firstPage = await loadPage(null);
    if (firstPage) {
      setPages([firstPage]);
      setCurrentPageIdx(0);
    }
  }, [loadPage]);

  const currentPage = pages[currentPageIdx];

  return {
    payments: currentPage?.payments || [],
    pageNumber: currentPageIdx + 1,
    hasNextPage: currentPage?.cursor != null,
    hasPreviousPage: currentPageIdx > 0,
    goToNextPage,
    goToPreviousPage,
    loadFirstPage,
    loading,
    error,
  };
}
