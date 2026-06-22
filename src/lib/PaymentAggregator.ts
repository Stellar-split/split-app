import type { Payment } from "@stellar-split/sdk";

export interface TopPayer {
  address: string;
  totalAmount: bigint;
  paymentCount: number;
  /** Share of total funded amount, 0–100 */
  sharePct: number;
}

/**
 * Aggregates payments for a single invoice into derived display data.
 * Initialise with existing payments, then call applyPayment as new ones arrive.
 */
export class PaymentAggregator {
  private readonly _total: bigint;
  private _funded: bigint = 0n;
  private _paymentCount = 0;
  private _lastPaymentAt: number | null = null;
  private _amountByPayer = new Map<string, bigint>();
  private _countByPayer = new Map<string, number>();

  constructor(total: bigint, existingPayments: Payment[] = []) {
    this._total = total;
    for (const p of existingPayments) {
      this._ingest(p);
    }
  }

  private _ingest(payment: Payment): void {
    this._funded += payment.amount;
    this._paymentCount += 1;
    this._lastPaymentAt = Date.now();
    this._amountByPayer.set(
      payment.payer,
      (this._amountByPayer.get(payment.payer) ?? 0n) + payment.amount,
    );
    this._countByPayer.set(
      payment.payer,
      (this._countByPayer.get(payment.payer) ?? 0) + 1,
    );
  }

  applyPayment(payment: Payment): void {
    this._ingest(payment);
  }

  get funded(): bigint {
    return this._funded;
  }

  /** 0–100, capped at 100 even when funded exceeds total */
  get progressPct(): number {
    if (this._total === 0n) return 0;
    const raw = Number((this._funded * 10_000n) / this._total) / 100;
    return Math.min(100, Math.max(0, raw));
  }

  get paymentCount(): number {
    return this._paymentCount;
  }

  get lastPaymentAt(): number | null {
    return this._lastPaymentAt;
  }

  /** Top payers sorted by total amount descending */
  get topPayers(): TopPayer[] {
    const entries = Array.from(this._amountByPayer.entries());
    entries.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
    return entries.map(([address, totalAmount]) => ({
      address,
      totalAmount,
      paymentCount: this._countByPayer.get(address) ?? 0,
      sharePct:
        this._funded > 0n
          ? Math.round(Number((totalAmount * 10_000n) / this._funded) / 100)
          : 0,
    }));
  }
}
