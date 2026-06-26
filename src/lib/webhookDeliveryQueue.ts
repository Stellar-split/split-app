/**
 * Webhook delivery queue with exponential backoff and dead-letter queue.
 * Persisted in localStorage under stellarsplit_ prefixed keys.
 *
 * Backoff schedule: 1m → 5m → 30m → 2h → dead-letter (after 4 failures)
 */

const QUEUE_KEY = "stellarsplit_webhook_queue";
const DLQ_KEY = "stellarsplit_webhook_dlq";
const HISTORY_KEY = "stellarsplit_webhook_history";

/** Backoff delays in milliseconds: 1m, 5m, 30m, 2h */
export const BACKOFF_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000];

export interface QueuedDelivery {
  id: string;
  url: string;
  payload: Record<string, unknown>;
  retryCount: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface DeadLetteredDelivery {
  id: string;
  url: string;
  payload: Record<string, unknown>;
  failedAt: number;
  lastError: string;
}

export interface DeliveryHistoryEntry {
  id: string;
  url: string;
  payload: Record<string, unknown>;
  sentAt: number;
  status: "success" | "failed";
  statusCode?: number;
  error?: string;
  isReplay: boolean;
  originalDeliveryId?: string;
}

function readQueue(): QueuedDelivery[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedDelivery[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readDLQ(): DeadLetteredDelivery[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DLQ_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeDLQ(dlq: DeadLetteredDelivery[]): void {
  localStorage.setItem(DLQ_KEY, JSON.stringify(dlq));
}

function readHistory(): DeliveryHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeHistory(history: DeliveryHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/** Add a new delivery to the queue (first attempt is immediate). */
export function enqueue(
  payload: Record<string, unknown>,
  url: string
): QueuedDelivery {
  const item: QueuedDelivery = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    payload,
    retryCount: 0,
    nextAttemptAt: Date.now(),
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

async function attempt(
  item: QueuedDelivery
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(item.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Process all queue items whose nextAttemptAt <= now.
 * Successful items are removed; failed items are rescheduled or dead-lettered.
 */
export async function processQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  let queue = readQueue();
  const dlq = readDLQ();

  const pending = queue.filter((item) => item.nextAttemptAt <= now);
  const deferred = queue.filter((item) => item.nextAttemptAt > now);

  for (const item of pending) {
    const result = await attempt(item);
    if (result.ok) {
      // success — drop from queue
      continue;
    }
    const nextRetry = item.retryCount + 1;
    if (nextRetry >= BACKOFF_DELAYS.length) {
      // dead-letter
      dlq.push({
        id: item.id,
        url: item.url,
        payload: item.payload,
        failedAt: Date.now(),
        lastError: result.error ?? "Unknown error",
      });
    } else {
      deferred.push({
        ...item,
        retryCount: nextRetry,
        nextAttemptAt: Date.now() + BACKOFF_DELAYS[nextRetry - 1],
        lastError: result.error,
      });
    }
  }

  writeQueue(deferred);
  writeDLQ(dlq);
}

/** Return all dead-lettered deliveries. */
export function getDeadLettered(): DeadLetteredDelivery[] {
  return readDLQ();
}

/** Return all delivery history entries, newest first. */
export function getDeliveryHistory(): DeliveryHistoryEntry[] {
  return readHistory().slice().reverse();
}

/** Record a delivery in history. Returns the entry with its generated id. */
export function addDeliveryHistoryEntry(
  entry: Omit<DeliveryHistoryEntry, "id">
): DeliveryHistoryEntry {
  const full: DeliveryHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const history = readHistory();
  history.push(full);
  writeHistory(history);
  return full;
}

/**
 * Replay a historical delivery by sending its original stored payload verbatim
 * to targetUrl. Appends a new history entry marked as a replay.
 * Does not affect the original entry's status or retry counters.
 */
export async function replayDelivery(
  originalId: string,
  targetUrl: string
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  const history = readHistory();
  const original = history.find((h) => h.id === originalId);
  if (!original) return { ok: false, error: "Delivery not found in history" };

  const sentAt = Date.now();
  let result: { ok: boolean; error?: string; statusCode?: number };
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(original.payload),
    });
    result = { ok: res.ok, statusCode: res.status };
    if (!res.ok) result.error = `HTTP ${res.status}`;
  } catch (e) {
    result = { ok: false, error: String(e) };
  }

  addDeliveryHistoryEntry({
    url: targetUrl,
    payload: original.payload,
    sentAt,
    status: result.ok ? "success" : "failed",
    statusCode: result.statusCode,
    error: result.error,
    isReplay: true,
    originalDeliveryId: originalId,
  });

  return result;
}

/**
 * Manually retry a dead-lettered delivery by id.
 * On success it is removed from the DLQ; on failure it stays.
 */
export async function retryDeadLettered(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const dlq = readDLQ();
  const idx = dlq.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, error: "Not found" };

  const item = dlq[idx];
  const result = await attempt({ ...item, retryCount: 0, nextAttemptAt: 0 });
  if (result.ok) {
    dlq.splice(idx, 1);
    writeDLQ(dlq);
  }
  return result;
}
