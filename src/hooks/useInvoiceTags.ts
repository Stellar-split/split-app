"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface TagListResponse {
  tags: string[];
  byInvoice: Record<string, string[]>;
}

/**
 * Module-level cache shared by every consumer. The tag list is small, changes
 * rarely, and is read by the dashboard filter, the create form and the detail
 * page at once — refetching per mount would be pure waste.
 */
let cache: TagListResponse | null = null;
let inflight: Promise<TagListResponse> | null = null;
const subscribers = new Set<(data: TagListResponse) => void>();

function publish(data: TagListResponse) {
  cache = data;
  subscribers.forEach((fn) => fn(data));
}

async function fetchTagList(force = false): Promise<TagListResponse> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  inflight = fetch("/api/invoices/tags")
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      return res.json();
    })
    .then((data: Partial<TagListResponse>) => {
      const normalized: TagListResponse = {
        tags: Array.isArray(data.tags) ? data.tags : [],
        byInvoice: data.byInvoice ?? {},
      };
      publish(normalized);
      return normalized;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Test seam — drops the shared cache between tests. */
export function __resetTagCache(): void {
  cache = null;
  inflight = null;
}

export interface UseInvoiceTagsResult {
  /** Every tag in use across all invoices, sorted. */
  allTags: string[];
  /** invoiceId → tags, for filtering a list without per-invoice requests. */
  tagsByInvoice: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  /** Re-fetch from the server, bypassing the cache. */
  refresh: () => Promise<void>;
  /** Replace one invoice's tags; updates the UI optimistically. */
  saveTags: (invoiceId: string, tags: string[]) => Promise<string[]>;
}

/**
 * useInvoiceTags — fetches and caches the full tag list, and writes tag changes
 * back through PATCH /api/invoices/:id/tags.
 */
export function useInvoiceTags(): UseInvoiceTagsResult {
  const [data, setData] = useState<TagListResponse>(
    () => cache ?? { tags: [], byInvoice: {} }
  );
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const onPublish = (next: TagListResponse) => {
      if (active) setData(next);
    };
    subscribers.add(onPublish);

    fetchTagList()
      .then(() => active && setError(null))
      .catch((err) => active && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      subscribers.delete(onPublish);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchTagList(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTags = useCallback(async (invoiceId: string, tags: string[]) => {
    const previous = cache ?? { tags: [], byInvoice: {} };

    // Optimistic: reflect the change everywhere before the request resolves.
    const optimisticByInvoice = { ...previous.byInvoice, [invoiceId]: tags };
    publish({
      tags: Array.from(new Set(Object.values(optimisticByInvoice).flat())).sort(),
      byInvoice: optimisticByInvoice,
    });

    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error(`Failed to save tags (${res.status})`);

      const body = (await res.json()) as { tags?: string[] };
      const saved = body.tags ?? tags;

      const confirmedByInvoice = { ...previous.byInvoice, [invoiceId]: saved };
      publish({
        tags: Array.from(new Set(Object.values(confirmedByInvoice).flat())).sort(),
        byInvoice: confirmedByInvoice,
      });
      setError(null);
      return saved;
    } catch (err) {
      publish(previous); // Roll back to the pre-request state.
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  return {
    allTags: data.tags,
    tagsByInvoice: data.byInvoice,
    loading,
    error,
    refresh,
    saveTags,
  };
}

export default useInvoiceTags;
