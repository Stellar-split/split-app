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

/**
 * Serializable queued transaction schema used by the hardened offline queue.
 * All fields are JSON-safe so the queue can be persisted to IndexedDB or
 * localStorage and hydrated on startup.
 */
export interface QueuedTransaction {
  id: string;
  payload: Record<string, unknown>;
  status: "pending" | "submitting" | "failed";
  attempts: number;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
  error?: string;
}

export type QueueStatus = {
  pending: number;
  submitting: number;
  failed: number;
  total: number;
  online: boolean;
  draining: boolean;
};

export type QueueStatusListener = (status: QueueStatus) => void;

const DB_NAME = "stellarsplit-offline";
const STORE_NAME = "payments";
const TX_STORE_NAME = "transactions";
const DB_VERSION = 2;

const LS_KEY = "stellarsplit-offline-queue";
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const DRAIN_DEBOUNCE_MS = 250;

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
      if (!db.objectStoreNames.contains(TX_STORE_NAME)) {
        db.createObjectStore(TX_STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function queuePayment(
  payment: Omit<QueuedPayment, "id" | "status">
) {
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

/* -------------------------------------------------------------------------- */
/* Hardened offline transaction queue                                         */
/* -------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readLocalStorageQueue(): QueuedTransaction[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is QueuedTransaction =>
        t && typeof t.id === "string" && typeof t.payload === "object"
    );
  } catch {
    return [];
  }
}

function writeLocalStorageQueue(queue: QueuedTransaction[]): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(queue));
  } catch {
    // Storage may be full or unavailable; ignore.
  }
}

async function readAllTransactions(): Promise<QueuedTransaction[]> {
  if (hasIndexedDB()) {
    try {
      const db = await openDB();
      const stored: QueuedTransaction[] = await db.getAll(TX_STORE_NAME);
      return stored;
    } catch {
      // Fall through to localStorage.
    }
  }
  return readLocalStorageQueue();
}

async function writeTransaction(tx: QueuedTransaction): Promise<void> {
  if (hasIndexedDB()) {
    try {
      const db = await openDB();
      await db.put(TX_STORE_NAME, tx);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
  const queue = readLocalStorageQueue();
  const idx = queue.findIndex((t) => t.id === tx.id);
  if (idx >= 0) queue[idx] = tx;
  else queue.push(tx);
  writeLocalStorageQueue(queue);
}

async function deleteTransaction(id: string): Promise<void> {
  if (hasIndexedDB()) {
    try {
      const db = await openDB();
      await db.delete(TX_STORE_NAME, id);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
  const queue = readLocalStorageQueue().filter((t) => t.id !== id);
  writeLocalStorageQueue(queue);
}

async function getTransaction(id: string): Promise<QueuedTransaction | undefined> {
  if (hasIndexedDB()) {
    try {
      const db = await openDB();
      const tx = await db.get(TX_STORE_NAME, id);
      if (tx) return tx as QueuedTransaction;
    } catch {
      // Fall through to localStorage.
    }
  }
  return readLocalStorageQueue().find((t) => t.id === id);
}

export function computeBackoffDelay(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.random() * exp * 0.25;
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    shouldRetry?: (error: unknown) => boolean;
    onAttempt?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const shouldRetry = options.shouldRetry ?? isNetworkError;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (options.onAttempt) options.onAttempt(attempt, err);
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError;
}

/* ------------------------------- Queue state ------------------------------ */

const statusListeners = new Set<QueueStatusListener>();
let draining = false;
let drainTimer: ReturnType<typeof setTimeout> | null = null;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;
let currentSubmitFn: ((tx: QueuedTransaction) => Promise<void>) | null = null;

export function isOnline(): boolean {
  if (!isBrowser()) return true;
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const txs = await readAllTransactions();
  const status: QueueStatus = {
    pending: 0,
    submitting: 0,
    failed: 0,
    total: txs.length,
    online: isOnline(),
    draining,
  };
  for (const tx of txs) {
    if (tx.status === "pending") status.pending++;
    else if (tx.status === "submitting") status.submitting++;
    else if (tx.status === "failed") status.failed++;
  }
  return status;
}

async function notifyStatus(): Promise<void> {
  if (statusListeners.size === 0) return;
  const status = await getQueueStatus();
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch {
      // Ignore listener errors.
    }
  }
}

export function subscribeToQueueStatus(
  listener: QueueStatusListener
): () => void {
  statusListeners.add(listener);
  void notifyStatus();
  return () => {
    statusListeners.delete(listener);
  };
}

/* ------------------------------ Queue APIs -------------------------------- */

export async function enqueueTransaction(
  payload: Record<string, unknown>
): Promise<string> {
  const now = Date.now();
  const tx: QueuedTransaction = {
    id: createId(),
    payload,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await writeTransaction(tx);
  await notifyStatus();
  return tx.id;
}

export async function getQueuedTransactions(): Promise<QueuedTransaction[]> {
  const txs = await readAllTransactions();
  txs.sort((a, b) => a.createdAt - b.createdAt);
  return txs;
}

export async function discardTransaction(id: string): Promise<void> {
  await deleteTransaction(id);
  await notifyStatus();
}

export async function discardAllFailed(): Promise<void> {
  const txs = await readAllTransactions();
  for (const tx of txs) {
    if (tx.status === "failed") {
      await deleteTransaction(tx.id);
    }
  }
  await notifyStatus();
}

async function attemptTransaction(
  tx: QueuedTransaction,
  submitFn: (tx: QueuedTransaction) => Promise<void>
): Promise<{ id: string; success: boolean; error?: string }> {
  const submitting: QueuedTransaction = {
    ...tx,
    status: "submitting",
    attempts: tx.attempts + 1,
    lastAttemptAt: Date.now(),
    updatedAt: Date.now(),
    error: undefined,
  };
  await writeTransaction(submitting);

  try {
    await retryWithBackoff(() => submitFn(submitting), {
      maxAttempts: 1,
      shouldRetry: isNetworkError,
    });
    await deleteTransaction(tx.id);
    return { id: tx.id, success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const network = isNetworkError(err);
    const exhausted = submitting.attempts >= MAX_ATTEMPTS;
    const nextStatus: QueuedTransaction["status"] =
      network && !exhausted ? "pending" : "failed";
    const updated: QueuedTransaction = {
      ...submitting,
      status: nextStatus,
      updatedAt: Date.now(),
      error: errorMsg,
    };
    await writeTransaction(updated);
    return { id: tx.id, success: false, error: errorMsg };
  }
}

export async function retryTransaction(
  id: string,
  submitFn: (tx: QueuedTransaction) => Promise<void>
): Promise<{ id: string; success: boolean; error?: string }> {
  const tx = await getTransaction(id);
  if (!tx) {
    return { id, success: false, error: `Transaction ${id} not found` };
  }
  const result = await attemptTransaction(tx, submitFn);
  await notifyStatus();
  return result;
}

export async function retryAllFailed(
  submitFn: (tx: QueuedTransaction) => Promise<void>
): Promise<Array<{ id: string; success: boolean; error?: string }>> {
  const txs = await readAllTransactions();
  const failed = txs.filter((t) => t.status === "failed");
  const results: Array<{ id: string; success: boolean; error?: string }> = [];
  for (const tx of failed) {
    results.push(await attemptTransaction(tx, submitFn));
  }
  await notifyStatus();
  return results;
}

export async function drainQueue(
  submitFn: (tx: QueuedTransaction) => Promise<void>
): Promise<Array<{ id: string; success: boolean; error?: string }>> {
  if (draining) return [];
  if (!isOnline()) return [];
  draining = true;
  await notifyStatus();
  const results: Array<{ id: string; success: boolean; error?: string }> = [];
  try {
    const txs = await readAllTransactions();
    const pending = txs.filter((t) => t.status === "pending");
    for (const tx of pending) {
      if (!isOnline()) break;
      results.push(await attemptTransaction(tx, submitFn));
    }
  } finally {
    draining = false;
    await notifyStatus();
  }
  return results;
}

function scheduleDrain(): void {
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    if (currentSubmitFn) {
      void drainQueue(currentSubmitFn);
    }
  }, DRAIN_DEBOUNCE_MS);
}

/**
 * Hydrate the queue on startup and install connectivity listeners that drain
 * the queue when the connection is restored. Returns a teardown function.
 */
export function initOfflineQueue(
  submitFn: (tx: QueuedTransaction) => Promise<void>
): () => void {
  currentSubmitFn = submitFn;

  if (isBrowser()) {
    onlineHandler = () => {
      scheduleDrain();
    };
    offlineHandler = () => {
      void notifyStatus();
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
  }

  // Hydrate + drain on startup if online.
  void (async () => {
    await notifyStatus();
    if (isOnline()) {
      scheduleDrain();
    }
  })();

  return () => {
    if (isBrowser()) {
      if (onlineHandler) window.removeEventListener("online", onlineHandler);
      if (offlineHandler) window.removeEventListener("offline", offlineHandler);
    }
    onlineHandler = null;
    offlineHandler = null;
    currentSubmitFn = null;
    if (drainTimer) {
      clearTimeout(drainTimer);
      drainTimer = null;
    }
  };
}