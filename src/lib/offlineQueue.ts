import { openDB as idbOpenDB, type IDBPDatabase } from "idb";

export interface QueuedPayment {
  id: string;
  invoiceId: string;
  amount: bigint;
  sender: string;
  timestamp: number;
  status: "pending" | "submitting" | "failed";
  error?: string;
}

interface StoredPayment {
  id: string;
  invoiceId: string;
  amount: string;
  sender: string;
  timestamp: number;
  status: "pending" | "submitting" | "failed";
  error?: string;
}

const DB_NAME = "stellarsplit-offline";
const STORE_NAME = "payments";
const DB_VERSION = 1;

function toStored(payment: QueuedPayment): StoredPayment {
  return { ...payment, amount: payment.amount.toString() };
}

function fromStored(stored: StoredPayment): QueuedPayment {
  return { ...stored, amount: BigInt(stored.amount) };
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function openDB(): Promise<IDBPDatabase> {
  return idbOpenDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function queuePayment(
  payment: Omit<QueuedPayment, "id" | "status">

  const db = await openDB();
  const id = createId();
  const stored = toStored({ ...payment, id, status: "pending" });
  await db.add(STORE_NAME, stored);
  return id;
}

export async function getQueuedPayments(): Promise<QueuedPayment[]> {
  const db = await openDB();
  const stored: StoredPayment[] = await db.getAll(STORE_NAME);
  const payments = stored.map(fromStored);
  payments.sort((a, b) => a.timestamp - b.timestamp);
  return payments;
}

export async function removePayment(id: string): Promise<void> {
  const db = await openDB();
  await db.delete(STORE_NAME, id);
}

export async function updatePaymentStatus(
  id: string,
  status: QueuedPayment["status"],
  error?: string
): Promise<void> {
  const db = await openDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) {
    throw new Error(`Payment ${id} not found`);
  }
  (existing as StoredPayment).status = status;
  if (error !== undefined) {
    (existing as StoredPayment).error = error;
  }
  await db.put(STORE_NAME, existing);
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  const stored: StoredPayment[] = await db.getAll(STORE_NAME);
  const count = stored.filter((p) => p.status === "pending").length;
  return count;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch") || msg.includes("network")) {
      return true;
    }
  }
  if (error instanceof Error) {
    if (error.name === "NetworkError" || error.name === "AbortError") {
      return true;
    }
  }
  return false;
}

export async function processQueue(
  submitFn: (payment: QueuedPayment) => Promise<void>
): Promise<Array<{ id: string; success: boolean; error?: string }>> {
  const payments = await getQueuedPayments();
  const pending = payments.filter((p) => p.status === "pending");
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const payment of pending) {
    await updatePaymentStatus(payment.id, "submitting");
    try {
      await submitFn(payment);
      await removePayment(payment.id);
      results.push({ id: payment.id, success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (isNetworkError(err)) {
        await updatePaymentStatus(payment.id, "pending", errorMsg);
        results.push({ id: payment.id, success: false, error: errorMsg });
      } else {
        await updatePaymentStatus(payment.id, "failed", errorMsg);
        results.push({ id: payment.id, success: false, error: errorMsg });
      }
    }
  }

  return results;
}

export function setupOnlineListener(
  submitFn: (payment: QueuedPayment) => Promise<void>
): () => void {
  const handler = () => {
    processQueue(submitFn);
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}