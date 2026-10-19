import type { Payment } from "@stellar-split/sdk";

export interface TopPayer {
  address: string;
  totalAmount: bigint;
  paymentCount: number;
  /** Share of total funded amount, 0–100 */
  sharePct: number;
}

/** Per-invoice aggregation snapshot used when bundling invoices. */
export interface InvoiceAggregate {
  invoiceId: string;
  total: bigint;
  funded: bigint;
  /** 0–100, capped at 100 even when funded exceeds total */
  progressPct: number;
  paymentCount: number;
  lastPaymentAt: number | null;
}

/** Combined aggregation across every invoice in a bundle. */
export interface BundleAggregate {
  total: bigint;
  funded: bigint;
  /** 0–100, capped at 100 even when funded exceeds total */
  progressPct: number;
  paymentCount: number;
  lastPaymentAt: number | null;
  invoices: InvoiceAggregate[];
}

/** Input for a single invoice when building a bundle aggregate. */
export interface BundleInvoiceInput {
  invoiceId: string;
  total: bigint;
  payments?: Payment[];
}

function progressPctFor(funded: bigint, total: bigint): number {
  if (total === 0n) return 0;
  const raw = Number((funded * 10_000n) / total) / 100;
  return Math.min(100, Math.max(0, raw));
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

  /** Snapshot of this invoice's aggregation, for use in bundle summaries. */
  toAggregate(invoiceId: string): InvoiceAggregate {
    return {
      invoiceId,
      total: this._total,
      funded: this._funded,
      progressPct: this.progressPct,
      paymentCount: this._paymentCount,
      lastPaymentAt: this._lastPaymentAt,
    };
  }

  /**
   * Aggregate totals across multiple invoices so unified bundle payment
   * collection can reuse the per-invoice aggregation logic.
   */
  static aggregateBundle(invoices: BundleInvoiceInput[]): BundleAggregate {
    let total = 0n;
    let funded = 0n;
    let paymentCount = 0;
    let lastPaymentAt: number | null = null;
    const aggregates: InvoiceAggregate[] = [];

    for (const invoice of invoices) {
      const aggregator = new PaymentAggregator(invoice.total, invoice.payments);
      const snapshot = aggregator.toAggregate(invoice.invoiceId);
      aggregates.push(snapshot);
      total += snapshot.total;
      funded += snapshot.funded;
      paymentCount += snapshot.paymentCount;
      if (
        snapshot.lastPaymentAt !== null &&
        (lastPaymentAt === null || snapshot.lastPaymentAt > lastPaymentAt)
      ) {
        lastPaymentAt = snapshot.lastPaymentAt;
      }
    }

    return {
      total,
      funded,
      progressPct: progressPctFor(funded, total),
      paymentCount,
      lastPaymentAt,
      invoices: aggregates,
    };
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
