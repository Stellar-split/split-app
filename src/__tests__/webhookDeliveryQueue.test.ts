/**
 * Unit tests for webhookDeliveryQueue:
 * - Backoff schedule timing
 * - Dead-letter transition after max retries
 * - Manual retry success path
 */

import {
  enqueue,
  processQueue,
  getDeadLettered,
  retryDeadLettered,
  getDeliveryHistory,
  addDeliveryHistoryEntry,
  replayDelivery,
  BACKOFF_DELAYS,
} from "@/lib/webhookDeliveryQueue";

// Minimal localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

let fetchMock: jest.Mock;

beforeEach(() => {
  localStorageMock.clear();
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

const PAYLOAD = { event: "invoice.paid", invoiceId: "inv-1" };
const URL = "https://example.com/hook";

describe("BACKOFF_DELAYS", () => {
  it("has 4 delay values: 1m, 5m, 30m, 2h", () => {
    expect(BACKOFF_DELAYS).toEqual([60_000, 300_000, 1_800_000, 7_200_000]);
  });
});

describe("processQueue — dead-letter transition", () => {
  it("moves item to dead-letter after 4 consecutive failures", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    enqueue(PAYLOAD, URL);

    // Run processQueue 4 times (retryCount goes 0→1→2→3→dead-letter)
    // Each run we need to wind the clock so nextAttemptAt <= now
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    jest.spyOn(Date, "now").mockImplementation(() => fakeNow);

    // Attempt 1 (retryCount 0 → schedule retry at +1m)
    await processQueue();
    expect(getDeadLettered()).toHaveLength(0);

    // Attempt 2
    fakeNow += BACKOFF_DELAYS[0];
    await processQueue();
    expect(getDeadLettered()).toHaveLength(0);

    // Attempt 3
    fakeNow += BACKOFF_DELAYS[1];
    await processQueue();
    expect(getDeadLettered()).toHaveLength(0);

    // Attempt 4 — hits BACKOFF_DELAYS.length limit → dead-letter
    fakeNow += BACKOFF_DELAYS[2];
    await processQueue();
    const dlq = getDeadLettered();
    expect(dlq).toHaveLength(1);
    expect(dlq[0].url).toBe(URL);
    expect(dlq[0].lastError).toBe("HTTP 500");

    jest.spyOn(Date, "now").mockRestore();
  });
});

describe("processQueue — backoff scheduling", () => {
  it("does not retry an item before its nextAttemptAt", async () => {
    // First attempt fails → schedules retry at +1m
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    enqueue(PAYLOAD, URL);
    await processQueue(); // attempt 1

    // Immediately calling processQueue again should NOT trigger another fetch
    await processQueue();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("retryDeadLettered — success path", () => {
  it("removes the item from the DLQ on a successful retry", async () => {
    // Push item to DLQ by exhausting retries
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    enqueue(PAYLOAD, URL);

    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    jest.spyOn(Date, "now").mockImplementation(() => fakeNow);

    await processQueue();
    fakeNow += BACKOFF_DELAYS[0];
    await processQueue();
    fakeNow += BACKOFF_DELAYS[1];
    await processQueue();
    fakeNow += BACKOFF_DELAYS[2];
    await processQueue();

    jest.spyOn(Date, "now").mockRestore();

    expect(getDeadLettered()).toHaveLength(1);
    const { id } = getDeadLettered()[0];

    // Now the endpoint is healthy
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await retryDeadLettered(id);
    expect(result.ok).toBe(true);
    expect(getDeadLettered()).toHaveLength(0);
  });

  it("keeps the item in the DLQ if retry fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    enqueue(PAYLOAD, URL);

    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    jest.spyOn(Date, "now").mockImplementation(() => fakeNow);

    await processQueue();
    fakeNow += BACKOFF_DELAYS[0];
    await processQueue();
    fakeNow += BACKOFF_DELAYS[1];
    await processQueue();
    fakeNow += BACKOFF_DELAYS[2];
    await processQueue();

    jest.spyOn(Date, "now").mockRestore();

    const { id } = getDeadLettered()[0];
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    const result = await retryDeadLettered(id);
    expect(result.ok).toBe(false);
    expect(getDeadLettered()).toHaveLength(1);
  });
});

describe("replayDelivery — sends identical payload as a distinct history entry", () => {
  it("sends the original payload verbatim to the target URL", async () => {
    const entry = addDeliveryHistoryEntry({
      url: URL,
      payload: PAYLOAD,
      sentAt: Date.now(),
      status: "success",
      isReplay: false,
    });

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await replayDelivery(entry.id, URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(URL);
    expect(JSON.parse(calledInit.body)).toEqual(PAYLOAD);
  });

  it("creates a new distinct history entry marked as a replay", async () => {
    const original = addDeliveryHistoryEntry({
      url: URL,
      payload: PAYLOAD,
      sentAt: Date.now(),
      status: "success",
      isReplay: false,
    });

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await replayDelivery(original.id, URL);

    const history = getDeliveryHistory();
    // newest-first: replay is first
    const replay = history[0];
    expect(replay.id).not.toBe(original.id);
    expect(replay.isReplay).toBe(true);
    expect(replay.originalDeliveryId).toBe(original.id);
    expect(replay.payload).toEqual(PAYLOAD);
  });

  it("does not modify the original history entry", async () => {
    const original = addDeliveryHistoryEntry({
      url: URL,
      payload: PAYLOAD,
      sentAt: Date.now(),
      status: "success",
      isReplay: false,
    });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await replayDelivery(original.id, URL);

    const history = getDeliveryHistory();
    const originalInHistory = history.find((h) => h.id === original.id);
    expect(originalInHistory).toBeDefined();
    expect(originalInHistory!.status).toBe("success");
    expect(originalInHistory!.isReplay).toBe(false);
  });

  it("returns error when original delivery id is not found", async () => {
    const result = await replayDelivery("nonexistent-id", URL);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records failed replay as a failed history entry", async () => {
    const original = addDeliveryHistoryEntry({
      url: URL,
      payload: PAYLOAD,
      sentAt: Date.now(),
      status: "success",
      isReplay: false,
    });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await replayDelivery(original.id, URL);
    expect(result.ok).toBe(false);

    const history = getDeliveryHistory();
    const replay = history[0];
    expect(replay.status).toBe("failed");
    expect(replay.isReplay).toBe(true);
  });
});
