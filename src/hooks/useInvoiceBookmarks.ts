"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceBookmark {
  invoiceId: string;
  /** Unix timestamp (ms) when the bookmark was created. */
  addedAt: number;
  /** Optional note attached to this bookmark. */
  note?: string;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  /** Invoice IDs that belong to this collection. */
  invoiceIds: string[];
  createdAt: number;
}

export interface BookmarkStore {
  bookmarks: InvoiceBookmark[];
  collections: BookmarkCollection[];
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = "stellarsplit_invoice_bookmarks";
const COLLECTION_NAME_MAX_LENGTH = 40;

function readStore(): BookmarkStore {
  if (typeof window === "undefined") return { bookmarks: [], collections: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bookmarks: [], collections: [] };
    const parsed = JSON.parse(raw);
    return {
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    };
  } catch {
    return { bookmarks: [], collections: [] };
  }
}

function writeStore(store: BookmarkStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCollectionName(
  name: string,
  existing: BookmarkCollection[],
  excludeId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Collection name is required";
  if (trimmed.length > COLLECTION_NAME_MAX_LENGTH)
    return `Name must be ${COLLECTION_NAME_MAX_LENGTH} characters or fewer`;
  const duplicate = existing.some(
    (c) => c.id !== excludeId && c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return "A collection with this name already exists";
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseInvoiceBookmarksResult {
  bookmarks: InvoiceBookmark[];
  collections: BookmarkCollection[];

  /** Returns true when the invoice has been bookmarked. */
  isBookmarked: (invoiceId: string) => boolean;

  /** Toggle bookmark for an invoice. Returns the new state (true = added). */
  toggleBookmark: (invoiceId: string, note?: string) => boolean;

  /** Add or update a note on a bookmark. */
  setBookmarkNote: (invoiceId: string, note: string) => void;

  /** Create a new collection. Returns an error string or null on success. */
  createCollection: (name: string) => string | null;

  /** Rename a collection. Returns an error string or null on success. */
  renameCollection: (id: string, name: string) => string | null;

  /** Delete a collection (bookmarks are NOT deleted, only disassociated). */
  deleteCollection: (id: string) => void;

  /** Add an invoice to a collection. */
  addToCollection: (collectionId: string, invoiceId: string) => void;

  /** Remove an invoice from a collection. */
  removeFromCollection: (collectionId: string, invoiceId: string) => void;

  /** Returns true when an invoice is in a specific collection. */
  isInCollection: (collectionId: string, invoiceId: string) => boolean;

  /** Remove all bookmarks and collections. */
  clearAll: () => void;
}

/**
 * Hook that manages invoice bookmarks and collections with localStorage persistence.
 */
export function useInvoiceBookmarks(): UseInvoiceBookmarksResult {
  const [store, setStore] = useState<BookmarkStore>({ bookmarks: [], collections: [] });

  // Hydrate from localStorage on mount
  useEffect(() => {
    setStore(readStore());
  }, []);

  const mutate = useCallback((updater: (prev: BookmarkStore) => BookmarkStore) => {
    setStore((prev) => {
      const next = updater(prev);
      writeStore(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (invoiceId: string) => store.bookmarks.some((b) => b.invoiceId === invoiceId),
    [store.bookmarks]
  );

  const toggleBookmark = useCallback(
    (invoiceId: string, note?: string): boolean => {
      const exists = store.bookmarks.some((b) => b.invoiceId === invoiceId);
      if (exists) {
        mutate((prev) => ({
          ...prev,
          bookmarks: prev.bookmarks.filter((b) => b.invoiceId !== invoiceId),
          // Also remove from all collections
          collections: prev.collections.map((c) => ({
            ...c,
            invoiceIds: c.invoiceIds.filter((id) => id !== invoiceId),
          })),
        }));
        return false;
      } else {
        mutate((prev) => ({
          ...prev,
          bookmarks: [
            ...prev.bookmarks,
            { invoiceId, addedAt: Date.now(), ...(note ? { note } : {}) },
          ],
        }));
        return true;
      }
    },
    [store.bookmarks, mutate]
  );

  const setBookmarkNote = useCallback(
    (invoiceId: string, note: string) => {
      mutate((prev) => ({
        ...prev,
        bookmarks: prev.bookmarks.map((b) =>
          b.invoiceId === invoiceId ? { ...b, note: note.trim() || undefined } : b
        ),
      }));
    },
    [mutate]
  );

  const createCollection = useCallback(
    (name: string): string | null => {
      const error = validateCollectionName(name, store.collections);
      if (error) return error;
      mutate((prev) => ({
        ...prev,
        collections: [
          ...prev.collections,
          {
            id:
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
            name: name.trim(),
            invoiceIds: [],
            createdAt: Date.now(),
          },
        ],
      }));
      return null;
    },
    [store.collections, mutate]
  );

  const renameCollection = useCallback(
    (id: string, name: string): string | null => {
      const error = validateCollectionName(name, store.collections, id);
      if (error) return error;
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === id ? { ...c, name: name.trim() } : c
        ),
      }));
      return null;
    },
    [store.collections, mutate]
  );

  const deleteCollection = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.filter((c) => c.id !== id),
      }));
    },
    [mutate]
  );

  const addToCollection = useCallback(
    (collectionId: string, invoiceId: string) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId && !c.invoiceIds.includes(invoiceId)
            ? { ...c, invoiceIds: [...c.invoiceIds, invoiceId] }
            : c
        ),
      }));
    },
    [mutate]
  );

  const removeFromCollection = useCallback(
    (collectionId: string, invoiceId: string) => {
      mutate((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === collectionId
            ? { ...c, invoiceIds: c.invoiceIds.filter((id) => id !== invoiceId) }
            : c
        ),
      }));
    },
    [mutate]
  );

  const isInCollection = useCallback(
    (collectionId: string, invoiceId: string) => {
      const collection = store.collections.find((c) => c.id === collectionId);
      return collection ? collection.invoiceIds.includes(invoiceId) : false;
    },
    [store.collections]
  );

  const clearAll = useCallback(() => {
    mutate(() => ({ bookmarks: [], collections: [] }));
  }, [mutate]);

  return {
    bookmarks: store.bookmarks,
    collections: store.collections,
    isBookmarked,
    toggleBookmark,
    setBookmarkNote,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    isInCollection,
    clearAll,
  };
}
