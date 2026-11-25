import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import type {
  AccountingInvoice,
  AccountingPayment,
  RemoteRecord,
} from "./types";

/**
 * Data mapping between StellarSplit records and accounting software records.
 *
 * Amounts on-chain are integer stroops (7 decimals); accounting software
 * expects decimal strings, so every amount goes through `formatAmount`.
 */

/** Minimal payment shape accepted by the mapper. */
export interface MappablePayment {
  id?: string;
  txHash?: string;
  invoiceId?: string;
  payer?: string;
  amount?: bigint | number | string;
  timestamp?: number;
  assetCode?: string;
}

const DEFAULT_CURRENCY = "USDC";

function toDecimal(value: bigint | number | string | undefined): string {
  if (value === undefined || value === null) return "0.00";
  if (typeof value === "bigint") return formatAmount(value);
  if (typeof value === "number") return value.toFixed(2);
  return value;
}

function toIsoDate(epochSeconds: number | undefined): string {
  const ms = epochSeconds ? epochSeconds * 1000 : Date.now();
  return new Date(ms).toISOString().slice(0, 10);
}

/** Maps a StellarSplit invoice status onto the accounting status vocabulary. */
export function mapInvoiceStatus(
  status: string,
  deadline?: number,
): AccountingInvoice["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "released" || normalized === "paid") return "paid";
  if (normalized === "cancelled" || normalized === "void") return "void";
  if (deadline && deadline * 1000 < Date.now()) return "overdue";
  return "open";
}

/** Maps a StellarSplit invoice to a provider-agnostic accounting invoice. */
export function mapInvoiceToAccounting(
  invoice: Invoice,
  currency: string = DEFAULT_CURRENCY,
): AccountingInvoice {
  const total = invoice.recipients.reduce(
    (sum, recipient) => sum + recipient.amount,
    0n,
  );

  return {
    externalId: invoice.id,
    customerName: invoice.creator,
    customerAddress: invoice.creator,
    currency,
    total: formatAmount(total),
    issueDate: toIsoDate(undefined),
    dueDate: toIsoDate(invoice.deadline),
    status: mapInvoiceStatus(invoice.status, invoice.deadline),
    lineItems: invoice.recipients.map((recipient) => ({
      description: `Invoice ${invoice.id} — ${recipient.address}`,
      amount: formatAmount(recipient.amount),
      quantity: 1,
    })),
  };
}

/** Maps a StellarSplit payment to a provider-agnostic accounting payment. */
export function mapPaymentToAccounting(
  payment: MappablePayment,
  currency: string = DEFAULT_CURRENCY,
): AccountingPayment {
  return {
    externalId: payment.id ?? payment.txHash ?? "",
    invoiceExternalId: payment.invoiceId ?? "",
    amount: toDecimal(payment.amount),
    currency: payment.assetCode ?? currency,
    date: toIsoDate(payment.timestamp),
    payer: payment.payer ?? "",
  };
}

/** Maps a remote accounting record back onto the local vocabulary. */
export function mapRemoteRecord(record: RemoteRecord): RemoteRecord {
  return {
    ...record,
    amount: toDecimal(record.amount),
    currency: record.currency || DEFAULT_CURRENCY,
  };
}
