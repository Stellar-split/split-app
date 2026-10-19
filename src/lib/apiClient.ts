"use client";

/**
 * Centralized fetch wrapper for mutating API calls. Injects the
 * `X-CSRF-Token` header (see src/lib/csrf.ts / src/lib/middleware/csrfMiddleware.ts)
 * on POST/PUT/PATCH/DELETE requests, refreshing the cached token before it
 * expires and transparently retrying once if a request is rejected with 403
 * because the token expired mid-flight.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Refresh a little early so a request that starts right before expiry
// doesn't race the server-side clock.
const REFRESH_SKEW_MS = 60 * 1000;

let cachedToken: string | null = null;
let cachedExpiresAt = 0;
let inflightFetch: Promise<string> | null = null;

async function fetchFreshToken(): Promise<string> {
  const response = await fetch("/api/csrf");
  if (!response.ok) {
    throw new Error("Failed to fetch CSRF token");
  }
  const data = await response.json();
  cachedToken = data.token;
  cachedExpiresAt = data.expiresAt;
  return data.token;
}

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedExpiresAt - REFRESH_SKEW_MS) {
    return cachedToken;
  }
  if (!forceRefresh && inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = fetchFreshToken().finally(() => {
    inflightFetch = null;
  });
  return inflightFetch;
}

export function getCachedCsrfExpiry(): number {
  return cachedExpiresAt;
}

/**
 * fetch() wrapper that attaches a CSRF token to mutating requests and
 * retries once, with a freshly-fetched token, if the server rejects the
 * first attempt with 403.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return fetch(input, init);
  }

  const attempt = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("X-CSRF-Token", token);
    return fetch(input, { ...init, headers });
  };

  const token = await getCsrfToken();
  const response = await attempt(token);
  if (response.status !== 403) {
    return response;
  }

  const freshToken = await getCsrfToken(true);
  return attempt(freshToken);
}

/**
 * Accounting integration API client (issue #878).
 *
 * These helpers back the payment export / reconciliation integration
 * endpoints. Mutating calls go through `apiFetch` so the CSRF token is
 * attached automatically.
 */

export type AccountingExportFormat = "csv" | "json" | "pdf";

export interface AccountingExportFilters {
  /** Inclusive ISO date (YYYY-MM-DD) lower bound. */
  startDate?: string;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound. */
  endDate?: string;
  /** Invoice statuses to include, e.g. ["paid", "pending"]. */
  statuses?: string[];
}

export interface AccountingExportPayload extends AccountingExportFilters {
  format: AccountingExportFormat;
  /** Optional accounting provider identifier, e.g. "quickbooks". */
  provider?: string;
}

export interface AccountingExport {
  id: string;
  format: AccountingExportFormat;
  status: "pending" | "processing" | "completed" | "failed";
  filters: AccountingExportFilters;
  provider?: string;
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ReconciliationReport {
  id?: string;
  periodStart: string;
  periodEnd: string;
  /** Totals keyed by invoice status or provider-specific bucket. */
  totals: Record<string, number>;
  lineItems?: Array<Record<string, unknown>>;
  generatedAt?: string;
}

async function parseJsonOrThrow<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/** Create a new accounting export (CSV, JSON or PDF). */
export async function createAccountingExport(
  payload: AccountingExportPayload
): Promise<AccountingExport> {
  const response = await apiFetch("/api/accounting/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<AccountingExport>(response, "create accounting export");
}

/** List previously created accounting exports (export history). */
export async function listAccountingExports(): Promise<AccountingExport[]> {
  const response = await apiFetch("/api/accounting/exports", { method: "GET" });
  return parseJsonOrThrow<AccountingExport[]>(response, "list accounting exports");
}

/** Fetch a single accounting export by id. */
export async function getAccountingExport(id: string): Promise<AccountingExport> {
  const response = await apiFetch(`/api/accounting/exports/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return parseJsonOrThrow<AccountingExport>(response, "get accounting export");
}

/** Push a reconciliation report to the accounting integration. */
export async function pushReconciliationReport(
  report: ReconciliationReport
): Promise<ReconciliationReport> {
  const response = await apiFetch("/api/accounting/reconciliations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  return parseJsonOrThrow<ReconciliationReport>(response, "push reconciliation report");
}
