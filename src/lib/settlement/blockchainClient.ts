/**
 * Stellar blockchain client used for payment verification and settlement
 * recording. Talks to Horizon over HTTP; every failure is surfaced as a typed
 * result instead of throwing so callers can degrade gracefully.
 */
import type { OnChainVerification } from './types';

export interface BlockchainClientOptions {
  horizonUrl?: string;
  networkPassphrase?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface HorizonPaymentRecord {
  id: string;
  transaction_hash: string;
  source_account: string;
  to?: string;
  from?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  successful?: boolean;
  created_at?: string;
}

export class BlockchainClient {
  private readonly horizonUrl: string;
  private readonly networkPassphrase: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BlockchainClientOptions = {}) {
    this.horizonUrl = (
      options.horizonUrl ??
      process.env.NEXT_PUBLIC_HORIZON_URL ??
      'https://horizon-testnet.stellar.org'
    ).replace(/\/$/, '');
    this.networkPassphrase =
      options.networkPassphrase ??
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
      'Test SDF Network ; September 2015';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  public getHorizonUrl(): string {
    return this.horizonUrl;
  }

  /**
   * Fetch a transaction from Horizon and normalise it for verification.
   * Never throws: transport/HTTP errors are returned as `found: false`.
   */
  public async verifyTransaction(txHash: string): Promise<OnChainVerification> {
    const checkedAt = Date.now();
    if (!txHash || txHash.length < 10) {
      return { txHash, found: false, successful: false, checkedAt, error: 'Invalid transaction hash' };
    }

    try {
      const response = await this.request(`/transactions/${encodeURIComponent(txHash)}`);
      if (response.status === 404) {
        return { txHash, found: false, successful: false, checkedAt, error: 'Transaction not found' };
      }
      if (!response.ok) {
        return {
          txHash,
          found: false,
          successful: false,
          checkedAt,
          error: `Horizon responded with ${response.status}`,
        };
      }

      const tx = (await response.json()) as {
        hash?: string;
        successful?: boolean;
        ledger?: number;
        source_account?: string;
        memo?: string;
      };

      const payment = await this.findPayment(txHash);

      return {
        txHash: tx.hash ?? txHash,
        found: true,
        successful: tx.successful !== false,
        ledger: tx.ledger,
        sourceAccount: tx.source_account,
        destinationAccount: payment?.to,
        amount: payment?.amount !== undefined ? Number(payment.amount) : undefined,
        asset: payment ? this.assetOf(payment) : undefined,
        memo: tx.memo,
        checkedAt,
      };
    } catch (err) {
      return {
        txHash,
        found: false,
        successful: false,
        checkedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Record a settlement on-chain by submitting a signed transaction envelope
   * (base64 XDR) to Horizon. Returns the resulting hash or a typed error.
   */
  public async submitTransaction(
    envelopeXdr: string
  ): Promise<{ submitted: boolean; txHash?: string; error?: string }> {
    try {
      const response = await this.request('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `tx=${encodeURIComponent(envelopeXdr)}`,
      });
      const body = (await response.json().catch(() => ({}))) as {
        hash?: string;
        extras?: { result_codes?: unknown };
      };
      if (!response.ok) {
        return {
          submitted: false,
          error: `Horizon rejected transaction (${response.status})`,
        };
      }
      return { submitted: true, txHash: body.hash };
    } catch (err) {
      return { submitted: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async findPayment(txHash: string): Promise<HorizonPaymentRecord | undefined> {
    try {
      const response = await this.request(
        `/transactions/${encodeURIComponent(txHash)}/payments?limit=1`
      );
      if (!response.ok) return undefined;
      const body = (await response.json()) as { _embedded?: { records?: HorizonPaymentRecord[] } };
      return body._embedded?.records?.[0];
    } catch {
      return undefined;
    }
  }

  private assetOf(payment: HorizonPaymentRecord): string {
    if (!payment.asset_type || payment.asset_type === 'native') return 'XLM';
    return payment.asset_code ?? payment.asset_type;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.horizonUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const defaultBlockchainClient = new BlockchainClient();
