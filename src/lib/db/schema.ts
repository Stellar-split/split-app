/**
 * Schema for the client-side invoice cache — object store names, key paths
 * and index definitions, kept separate from invoiceCache.ts so the shape of
 * the store is easy to find without wading through cache logic.
 */
import type { DBSchema } from "idb";
import type { Invoice } from "@stellar-split/sdk";

export const DB_NAME = "stellarsplit-invoice-cache";
export const DB_VERSION = 2;
export const INVOICES_STORE = "invoices";
export const INVOICE_VERSIONS_STORE = "invoiceVersions";
export const AMENDMENTS_STORE = "amendments";

/** A cached invoice, tagged with the owner it was fetched for and when it landed in the cache. */
export interface CachedInvoice {
  id: string;
  ownerAddress: string;
  status: Invoice["status"] | string;
  cachedAt: number;
  invoice: Invoice;
}

/** A single field-level change captured between two invoice versions. */
export interface InvoiceVersionDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

/** A stored snapshot of an invoice at a point in time, with the diff from its predecessor. */
export interface InvoiceVersion {
  /** Unique version id (e.g. `${invoiceId}:${versionNumber}`). */
  id: string;
  invoiceId: string;
  versionNumber: number;
  createdAt: number;
  /** Address of the party that produced this version. */
  createdBy: string;
  /** Full invoice snapshot at this version. */
  invoice: Invoice;
  /** Field-level diff against the previous version (empty for the initial version). */
  diff: InvoiceVersionDiffEntry[];
  /** Optional reference to the amendment that produced this version. */
  amendmentId?: string;
}

/** An amendment record capturing the reason and comments for a change. */
export interface InvoiceAmendment {
  /** Unique amendment id. */
  id: string;
  invoiceId: string;
  /** Version id this amendment produced. */
  versionId: string;
  /** Version id this amendment was applied on top of. */
  previousVersionId?: string;
  reason: string;
  comment?: string;
  /** Address of the party that made the amendment. */
  amendedBy: string;
  createdAt: number;
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
  [INVOICE_VERSIONS_STORE]: {
    key: string;
    value: InvoiceVersion;
    indexes: {
      "by-invoice": string;
      "by-timestamp": number;
    };
  };
  [AMENDMENTS_STORE]: {
    key: string;
    value: InvoiceAmendment;
    indexes: {
      "by-invoice": string;
      "by-timestamp": number;
    };
  };
}