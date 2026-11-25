/**
 * IndexedDB-backed cache for the invoice list, replacing the old
 * localStorage-based approach: async (no main-thread jank on large lists),
 * not capped at ~5 MB, and queryable by index instead of a linear scan.
 *
 * Invoices are on-chain and have no `updatedAt` field, so "newer" is decided
 * by content, not a timestamp: every successful network fetch simply
 * overwrites the cached row for that id (the network is always the source
 * of truth — the cache only exists to paint something before it responds).
 */
import { openDB, type IDBPDatabase } from "idb";
import type { Invoice } from "@stellar-split/sdk";
import { DB_NAME, DB_VERSION, INVOICES_STORE, type CachedInvoice, type InvoiceCacheDBSchema } from "./schema";

let dbPromise: Promise<IDBPDatabase<InvoiceCacheDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<InvoiceCacheDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<InvoiceCacheDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(INVOICES_STORE)) {
          const store = db.createObjectStore(INVOICES_STORE, { keyPath: "id" });
          store.createIndex("by-status", "status");
          store.createIndex("by-owner", "ownerAddress");
        }
      },
    });
  }
  return dbPromise;
}

export class QuotaExceededCacheError extends Error {
  constructor(cause: unknown) {
    super("IndexedDB quota exceeded while caching invoices");
    this.name = "QuotaExceededCacheError";
    this.cause = cause;
  }
}

function isQuotaExceeded(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.code === 22)
  );
}

/** Cached invoices for one owner address, most recently cached first. */
export async function getCachedInvoices(ownerAddress: string): Promise<Invoice[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex(INVOICES_STORE, "by-owner", ownerAddress);
    return all.sort((a, b) => b.cachedAt - a.cachedAt).map((row) => row.invoice);
  } catch {
    // Cache read failures (private browsing, disabled storage) degrade to
    // "no cache" rather than blocking the page.
    return [];
  }
}

/**
 * Writes a page of invoices to the cache. Throws QuotaExceededCacheError on
 * quota errors so the caller can fall back to network-only and surface a
 * non-blocking warning, instead of losing the fetch entirely.
 */
export async function putCachedInvoices(ownerAddress: string, invoices: Invoice[]): Promise<void> {
  if (invoices.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(INVOICES_STORE, "readwrite");
    const now = Date.now();
    await Promise.all([
      ...invoices.map((invoice) => {
        const row: CachedInvoice = {
          id: invoice.id,
          ownerAddress,
          status: invoice.status,
          cachedAt: now,
          invoice,
        };
        return tx.store.put(row);
      }),
      tx.done,
    ]);
  } catch (err) {
    if (isQuotaExceeded(err)) {
      throw new QuotaExceededCacheError(err);
    }
    // Any other cache write failure is non-fatal — the API response still renders.
  }
}

/** All invoices in the cache matching a given status, across all owners. */
export async function getCachedInvoicesByStatus(status: string): Promise<Invoice[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex(INVOICES_STORE, "by-status", status);
    return all.map((row) => row.invoice);
  } catch {
    return [];
  }
}

/** Wipes every stored invoice without requiring a hard page reload. */
export async function clearInvoiceCache(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/** Test seam — drops the open DB handle so tests get a fresh connection. */
export function __resetInvoiceCacheForTests(): void {
  dbPromise = null;
}
