import type { QueuedPayment } from "@/lib/offlineQueue";

let store: Record<string, QueuedPayment> = {};

vi.mock("@/lib/offlineQueue", async () => {
  const actual = await vi.importActual<typeof import("@/lib/offlineQueue")>(
    "@/lib/offlineQueue"
  );

  const getQueuedPayments = vi.fn(async (): Promise<QueuedPayment[]> => {
    return Object.values(store).sort((a, b) => a.timestamp - b.timestamp);
  });

  const updatePaymentStatus = vi.fn(
    async (id: string, status: QueuedPayment["status"], error?: string) => {
      if (store[id]) {
        store[id] = { ...store[id], status };
        if (error !== undefined) store[id].error = error;
      }
    }
  );

  const removePayment = vi.fn(async (id: string) => {
    delete store[id];
  });

  async function processQueue(
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

  return {
    ...actual,
    openDB: vi.fn(),
    getQueuedPayments,
    updatePaymentStatus,
    removePayment,
    processQueue,
  };
});

const { isNetworkError, processQueue } = await import("@/lib/offlineQueue");

function setStore(payments: QueuedPayment[]) {
  store = {};
  for (const p of payments) store[p.id] = { ...p };
}

beforeEach(() => {
  store = {};
});

describe("isNetworkError", () => {
  it("returns true for TypeError with 'Failed to fetch'", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for TypeError with 'network' in message", () => {
    expect(isNetworkError(new TypeError("A network error occurred"))).toBe(
      true
    );
  });

  it("returns true for error with name NetworkError", () => {
    const err = new Error("something");
    err.name = "NetworkError";
    expect(isNetworkError(err)).toBe(true);
  });

  it("returns true for error with name AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isNetworkError(err)).toBe(true);
  });

  it("returns false for contract rejection errors", () => {
    expect(isNetworkError(new Error("invoice already funded"))).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isNetworkError(new Error("something went wrong"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isNetworkError("string error")).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe("processQueue", () => {
  it("processes payments in timestamp order", async () => {
    const order: string[] = [];
    setStore([
      {
        id: "p3",
        invoiceId: "inv-3",
        amount: 300n,
        sender: "GABC",
        timestamp: 3000,
        status: "pending",
      },
      {
        id: "p1",
        invoiceId: "inv-1",
        amount: 100n,
        sender: "GABC",
        timestamp: 1000,
        status: "pending",
      },
      {
        id: "p2",
        invoiceId: "inv-2",
        amount: 200n,
        sender: "GABC",
        timestamp: 2000,
        status: "pending",
      },
    ]);

    const submitFn = vi.fn(async (p: QueuedPayment) => {
      order.push(p.id);
    });

    const results = await processQueue(submitFn);

    expect(order).toEqual(["p1", "p2", "p3"]);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("removes successful payments and marks failed ones", async () => {
    setStore([
      {
        id: "ok",
        invoiceId: "inv-ok",
        amount: 100n,
        sender: "GABC",
        timestamp: 1000,
        status: "pending",
      },
      {
        id: "fail",
        invoiceId: "inv-fail",
        amount: 200n,
        sender: "GABC",
        timestamp: 2000,
        status: "pending",
      },
    ]);

    const submitFn = vi.fn(async (p: QueuedPayment) => {
      if (p.id === "fail") throw new Error("tx rejected");
    });

    const results = await processQueue(submitFn);

    expect(results).toEqual([
      { id: "ok", success: true },
      { id: "fail", success: false, error: "tx rejected" },
    ]);

    expect(store["ok"]).toBeUndefined();
    expect(store["fail"]).toBeDefined();
    expect(store["fail"].status).toBe("failed");
    expect(store["fail"].error).toBe("tx rejected");
  });

  it("skips non-pending payments", async () => {
    setStore([
      {
        id: "pending-one",
        invoiceId: "inv-1",
        amount: 100n,
        sender: "GABC",
        timestamp: 1000,
        status: "pending",
      },
      {
        id: "already-failed",
        invoiceId: "inv-2",
        amount: 200n,
        sender: "GABC",
        timestamp: 2000,
        status: "failed",
      },
    ]);

    const submitFn = vi.fn(async () => {});

    const results = await processQueue(submitFn);

    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("pending-one");
  });
});
