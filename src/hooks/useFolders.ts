"use client";

import { useCallback, useEffect, useState } from "react";
import type { Folder } from "@/lib/folders";

interface FolderListResponse {
  folders: Folder[];
  byInvoice: Record<string, string[]>;
}

/**
 * Module-level cache shared by every consumer, mirroring useInvoiceTags — the
 * folder list is read by the sidebar and the invoice list filter at once.
 */
let cache: FolderListResponse | null = null;
let inflight: Promise<FolderListResponse> | null = null;
const subscribers = new Set<(data: FolderListResponse) => void>();

function publish(data: FolderListResponse) {
  cache = data;
  subscribers.forEach((fn) => fn(data));
}

async function fetchFolderList(force = false): Promise<FolderListResponse> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  inflight = fetch("/api/folders")
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load folders (${res.status})`);
      return res.json();
    })
    .then((data: Partial<FolderListResponse>) => {
      const normalized: FolderListResponse = {
        folders: Array.isArray(data.folders) ? data.folders : [],
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
export function __resetFolderCache(): void {
  cache = null;
  inflight = null;
}

export interface UseFoldersResult {
  folders: Folder[];
  /** invoiceId → folder ids, for filtering a list without per-invoice requests. */
  foldersByInvoice: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  /** Replace one invoice's folder membership; updates the UI optimistically. */
  assignFolders: (invoiceId: string, folderIds: string[]) => Promise<string[]>;
}

/**
 * useFolders — fetches and caches the folder list + membership map, and
 * writes changes back through the /api/folders endpoints.
 */
export function useFolders(): UseFoldersResult {
  const [data, setData] = useState<FolderListResponse>(
    () => cache ?? { folders: [], byInvoice: {} }
  );
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const onPublish = (next: FolderListResponse) => {
      if (active) setData(next);
    };
    subscribers.add(onPublish);

    fetchFolderList()
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
      await fetchFolderList(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (name: string) => {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create folder (${res.status})`);
    const body = (await res.json()) as { folder: Folder };
    const previous = cache ?? { folders: [], byInvoice: {} };
    publish({ ...previous, folders: [...previous.folders, body.folder] });
    return body.folder;
  }, []);

  const renameFolderFn = useCallback(async (id: string, name: string) => {
    const previous = cache ?? { folders: [], byInvoice: {} };
    publish({
      ...previous,
      folders: previous.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    });

    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      publish(previous);
      throw new Error(`Failed to rename folder (${res.status})`);
    }
  }, []);

  const deleteFolderFn = useCallback(async (id: string) => {
    const previous = cache ?? { folders: [], byInvoice: {} };
    const nextByInvoice = { ...previous.byInvoice };
    for (const invoiceId of Object.keys(nextByInvoice)) {
      nextByInvoice[invoiceId] = nextByInvoice[invoiceId].filter((f) => f !== id);
    }
    publish({
      folders: previous.folders.filter((f) => f.id !== id),
      byInvoice: nextByInvoice,
    });

    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      publish(previous);
      throw new Error(`Failed to delete folder (${res.status})`);
    }
  }, []);

  const assignFolders = useCallback(async (invoiceId: string, folderIds: string[]) => {
    const previous = cache ?? { folders: [], byInvoice: {} };

    const optimisticByInvoice = { ...previous.byInvoice, [invoiceId]: folderIds };
    publish({ ...previous, byInvoice: optimisticByInvoice });

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/folders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderIds }),
      });
      if (!res.ok) throw new Error(`Failed to save folders (${res.status})`);

      const body = (await res.json()) as { folderIds?: string[] };
      const saved = body.folderIds ?? folderIds;

      const confirmedByInvoice = { ...previous.byInvoice, [invoiceId]: saved };
      publish({ ...previous, byInvoice: confirmedByInvoice });
      return saved;
    } catch (err) {
      publish(previous);
      throw err;
    }
  }, []);

  return {
    folders: data.folders,
    foldersByInvoice: data.byInvoice,
    loading,
    error,
    refresh,
    createFolder,
    renameFolder: renameFolderFn,
    deleteFolder: deleteFolderFn,
    assignFolders,
  };
}

export default useFolders;
