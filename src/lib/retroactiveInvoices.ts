/**
 * Retroactive invoices record an on-chain transaction that already happened
 * outside StellarSplit. There's nothing to fund on-chain — the invoice is a
 * client-side accounting record, so it's persisted locally rather than
 * created against the split contract.
 */
import type { Invoice } from "@stellar-split/sdk";

export interface RetroactiveInvoice extends Invoice {
  retroactive: true;
  sourceTxHash: string;
  memo: string | null;
  createdAt: string;
}

const STORAGE_KEY = "stellarsplit_retroactive_invoices";
const ID_PREFIX = "retro-";

function loadAll(): Record<string, RetroactiveInvoice> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, RetroactiveInvoice>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

export function isRetroactiveInvoiceId(id: string): boolean {
  return id.startsWith(ID_PREFIX);
}

export function generateRetroactiveInvoiceId(txHash: string): string {
  return `${ID_PREFIX}${txHash.slice(0, 12)}-${Date.now().toString(36)}`;
}

export function saveRetroactiveInvoice(invoice: RetroactiveInvoice): void {
  const all = loadAll();
  all[invoice.id] = invoice;
  saveAll(all);
}

type SerialisedRetroactiveInvoice = Omit<RetroactiveInvoice, "funded" | "recipients" | "payments"> & {
  funded: unknown;
  recipients: Array<{ address: string; amount: unknown }>;
  payments: Array<{ payer: string; amount: unknown }>;
};

function toBigInt(value: unknown): bigint {
  return typeof value === "bigint" ? value : BigInt(value as string);
}

/** Re-hydrates bigint fields that JSON.stringify serialised as strings. */
export function getRetroactiveInvoice(id: string): RetroactiveInvoice | null {
  const raw = loadAll()[id] as unknown;
  if (!raw || typeof raw !== "object") return null;
  const inv = raw as SerialisedRetroactiveInvoice;
  return {
    ...inv,
    funded: toBigInt(inv.funded),
    recipients: inv.recipients.map((r) => ({ address: r.address, amount: toBigInt(r.amount) })),
    payments: inv.payments.map((p) => ({ payer: p.payer, amount: toBigInt(p.amount) })),
  };
}

export function listRetroactiveInvoiceIds(): string[] {
  return Object.keys(loadAll());
}
