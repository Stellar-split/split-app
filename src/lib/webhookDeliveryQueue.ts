import { computeWebhookSignature } from "./webhookSignature";

/**
 * Webhook delivery queue with exponential backoff and dead-letter queue.
 * Persisted in localStorage under stellarsplit_ prefixed keys.
 *
 * Backoff schedule: 1m → 5m → 30m → 2h → dead-letter (after 4 failures)
 */

const QUEUE_KEY = "stellarsplit_webhook_queue";
const DLQ_KEY = "stellarsplit_webhook_dlq";

/** Backoff delays in milliseconds: 1m, 5m, 30m, 2h */
export const BACKOFF_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000];

export interface QueuedDelivery {
  id: string;
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
  retryCount: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface DeadLetteredDelivery {
  id: string;
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
  failedAt: number;
  lastError: string;
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

/** Add a new delivery to the queue (first attempt is immediate). */
export function enqueue(
  payload: Record<string, unknown>,
  url: string,
  secret?: string
): QueuedDelivery {
  const item: QueuedDelivery = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    secret,
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
    const payloadStr = JSON.stringify(item.payload);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (item.secret) {
      headers["X-Webhook-Signature"] = await computeWebhookSignature(item.secret, payloadStr);
    }
    const res = await fetch(item.url, {
      method: "POST",
      headers,
      body: payloadStr,
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
        secret: item.secret,
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
