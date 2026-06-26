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

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queuePayment(
  payment: Omit<QueuedPayment, "id" | "status">
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const stored = toStored({ ...payment, id, status: "pending" });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(stored);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedPayments(): Promise<QueuedPayment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const stored: StoredPayment[] = request.result;
      const payments = stored.map(fromStored);
      payments.sort((a, b) => a.timestamp - b.timestamp);
      resolve(payments);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removePayment(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updatePaymentStatus(
  id: string,
  status: QueuedPayment["status"],
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing: StoredPayment | undefined = getReq.result;
      if (!existing) {
        reject(new Error(`Payment ${id} not found`));
        return;
      }
      existing.status = status;
      if (error !== undefined) {
        existing.error = error;
      }
      store.put(existing);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const stored: StoredPayment[] = request.result;
      const count = stored.filter((p) => p.status === "pending").length;
      resolve(count);
    };
    request.onerror = () => reject(request.error);
  });
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
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error";
      await updatePaymentStatus(payment.id, "failed", errorMsg);
      results.push({ id: payment.id, success: false, error: errorMsg });
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
