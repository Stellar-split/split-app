/**
 * Shared types for accounting software integrations (QuickBooks, Xero, …).
 *
 * The integration layer is provider-agnostic: every provider implements the
 * `AccountingProvider` interface, and the sync engine only ever talks to that
 * interface. Provider-specific payload shapes live in the provider modules.
 */

export type AccountingProviderId = "quickbooks" | "xero";

/** Credentials for a connected accounting tenant. */
export interface AccountingCredentials {
  /** OAuth access token (never logged, never returned by the API). */
  accessToken: string;
  /** OAuth refresh token, when the provider issues one. */
  refreshToken?: string;
  /** Provider tenant / company / organisation id. */
  tenantId: string;
  /** Epoch ms at which the access token expires. */
  expiresAt?: number;
}

/** A provider-agnostic invoice, already mapped from a StellarSplit invoice. */
export interface AccountingInvoice {
  /** StellarSplit invoice id — used as the idempotency key. */
  externalId: string;
  customerName: string;
  customerAddress: string;
  currency: string;
  /** Total amount as a decimal string, e.g. "125.50". */
  total: string;
  /** ISO 8601 date (YYYY-MM-DD). */
  issueDate: string;
  dueDate: string;
  status: "open" | "paid" | "overdue" | "void";
  lineItems: AccountingLineItem[];
}

export interface AccountingLineItem {
  description: string;
  /** Decimal string amount. */
  amount: string;
  quantity: number;
}

/** A provider-agnostic payment / settlement record. */
export interface AccountingPayment {
  /** StellarSplit payment id or tx hash — idempotency key. */
  externalId: string;
  /** StellarSplit invoice id this payment settles. */
  invoiceExternalId: string;
  /** Decimal string amount. */
  amount: string;
  currency: string;
  /** ISO 8601 date (YYYY-MM-DD). */
  date: string;
  payer: string;
}

/** Result of pushing one record to a provider. */
export interface PushResult {
  externalId: string;
  providerId: string;
  action: "created" | "updated" | "skipped";
}

/** A record pulled back from the provider, used for reconciliation. */
export interface RemoteRecord {
  providerId: string;
  externalId: string;
  amount: string;
  currency: string;
  date: string;
  status: string;
}

/** Every provider must implement this surface. */
export interface AccountingProvider {
  readonly id: AccountingProviderId;
  readonly displayName: string;
  /** Push (create or update) an invoice. Must be idempotent on externalId. */
  pushInvoice(
    credentials: AccountingCredentials,
    invoice: AccountingInvoice,
  ): Promise<PushResult>;
  /** Push a payment against an already-synced invoice. */
  pushPayment(
    credentials: AccountingCredentials,
    payment: AccountingPayment,
  ): Promise<PushResult>;
  /** Pull remote records for reconciliation. */
  fetchRecords(
    credentials: AccountingCredentials,
    since: string,
  ): Promise<RemoteRecord[]>;
}

/** Persisted state of one connection. */
export interface AccountingConnection {
  id: string;
  provider: AccountingProviderId;
  tenantId: string;
  /** Stellar address that owns the connection. */
  ownerAddress: string;
  status: "active" | "error" | "disconnected";
  createdAt: string;
  lastSyncedAt?: string;
  lastError?: string;
}

export type SyncDirection = "push" | "pull";

export interface SyncError {
  externalId?: string;
  message: string;
  /** True when the failure is retryable (network / 5xx / 429). */
  retryable: boolean;
  at: string;
}

export interface SyncResult {
  provider: AccountingProviderId;
  direction: SyncDirection;
  pushed: number;
  pulled: number;
  skipped: number;
  errors: SyncError[];
  startedAt: string;
  finishedAt: string;
}

export interface ReconciliationMismatch {
  externalId: string;
  localAmount: string;
  remoteAmount: string;
  /** remote - local, as a decimal string. */
  difference: string;
  kind: "missing_remote" | "missing_local" | "amount_mismatch";
}

export interface ReconciliationResult {
  provider: AccountingProviderId;
  matched: number;
  mismatches: ReconciliationMismatch[];
  generatedAt: string;
}
