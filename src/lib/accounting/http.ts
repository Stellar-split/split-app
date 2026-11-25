import type {
  AccountingCredentials,
  AccountingInvoice,
  AccountingPayment,
  AccountingProvider,
  AccountingProviderId,
  PushResult,
  RemoteRecord,
} from "./types";

/**
 * Shared HTTP plumbing for OAuth2-based accounting providers.
 *
 * Providers differ only in base URL, resource paths and payload shape, so the
 * request/retry/error handling lives here once.
 */

export class AccountingApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccountingApiError";
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

export interface ProviderConfig {
  id: AccountingProviderId;
  displayName: string;
  baseUrl: string;
  invoicePath: string;
  paymentPath: string;
  /** Path used to list records for reconciliation. */
  recordsPath: string;
}

/** Performs an authenticated JSON request against a provider API. */
export async function providerRequest<T>(
  config: ProviderConfig,
  credentials: AccountingCredentials,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Tenant-Id": credentials.tenantId,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AccountingApiError(
      `${config.displayName} request failed (${response.status}): ${detail.slice(0, 200)}`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Builds a provider implementation from a config + payload mappers. */
export function createProvider(
  config: ProviderConfig,
  mappers: {
    invoicePayload: (invoice: AccountingInvoice) => unknown;
    paymentPayload: (payment: AccountingPayment) => unknown;
    parseRecord: (raw: Record<string, unknown>) => RemoteRecord;
  },
): AccountingProvider {
  return {
    id: config.id,
    displayName: config.displayName,

    async pushInvoice(
      credentials: AccountingCredentials,
      invoice: AccountingInvoice,
    ): Promise<PushResult> {
      const created = await providerRequest<{ Id?: string; id?: string }>(
        config,
        credentials,
        config.invoicePath,
        { method: "POST", body: mappers.invoicePayload(invoice) },
      );
      return {
        externalId: invoice.externalId,
        providerId: String(created?.Id ?? created?.id ?? invoice.externalId),
        action: "created",
      };
    },

    async pushPayment(
      credentials: AccountingCredentials,
      payment: AccountingPayment,
    ): Promise<PushResult> {
      const created = await providerRequest<{ Id?: string; id?: string }>(
        config,
        credentials,
        config.paymentPath,
        { method: "POST", body: mappers.paymentPayload(payment) },
      );
      return {
        externalId: payment.externalId,
        providerId: String(created?.Id ?? created?.id ?? payment.externalId),
        action: "created",
      };
    },

    async fetchRecords(
      credentials: AccountingCredentials,
      since: string,
    ): Promise<RemoteRecord[]> {
      const body = await providerRequest<{ records?: Record<string, unknown>[] }>(
        config,
        credentials,
        config.recordsPath,
        { query: { since } },
      );
      return (body?.records ?? []).map(mappers.parseRecord);
    },
  };
}
