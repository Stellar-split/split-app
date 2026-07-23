// Persists receipt data keyed by invoiceId so history page can show download buttons

export interface StoredReceipt {
  txHash: string;
  date: number; // unix ms
  payerAddress: string;
  invoiceId: string;
  amountPaid: string; // stringified bigint
  tipAmount: string;  // stringified bigint
  isDelegated?: boolean;
}

const KEY = (invoiceId: string) => `stellarsplit_receipt_${invoiceId}`;

export function saveReceipt(receipt: StoredReceipt): void {
  try {
    localStorage.setItem(KEY(receipt.invoiceId), JSON.stringify(receipt));
  } catch {}
}

export function loadReceipt(invoiceId: string): StoredReceipt | null {
  try {
    const raw = localStorage.getItem(KEY(invoiceId));
    return raw ? (JSON.parse(raw) as StoredReceipt) : null;
  } catch {
    return null;
  }
}
