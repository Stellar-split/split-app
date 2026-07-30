/**
 * Schema for the client-side invoice cache — object store names, key paths
 * and index definitions, kept separate from invoiceCache.ts so the shape of
 * the store is easy to find without wading through cache logic.
 */
import type { DBSchema } from "idb";
import type { Invoice } from "@stellar-split/sdk";

export const DB_NAME = "stellarsplit-invoice-cache";
export const DB_VERSION = 1;
export const INVOICES_STORE = "invoices";

/** A cached invoice, tagged with the owner it was fetched for and when it landed in the cache. */
export interface CachedInvoice {
  id: string;
  ownerAddress: string;
  status: Invoice["status"] | string;
  cachedAt: number;
  invoice: Invoice;
}

export interface InvoiceCacheDBSchema extends DBSchema {
  [INVOICES_STORE]: {
    key: string;
    value: CachedInvoice;
    indexes: {
      "by-status": string;
      "by-owner": string;
    };
  };
}
