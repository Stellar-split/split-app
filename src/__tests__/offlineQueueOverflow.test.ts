import {
  queuePayment,
  getQueuedPayments,
  configureOfflineQueue,
  resetOfflineQueueConfig,
  OverflowError,
} from "@/lib/offlineQueue";

interface StoredItem {
  id: string;
  invoiceId: string;
  amount: string;
  sender: string;
  timestamp: number;
  status: "pending" | "submitting" | "failed";
  error?: string;
}

let mockStore = new Map<string, StoredItem>();

const mockDB = {
  getAll: vi.fn(async () => Array.from(mockStore.values())),
  add: vi.fn(async (_store: string, item: StoredItem) => {
    mockStore.set(item.id, item);
  }),
  delete: vi.fn(async (_store: string, id: string) => {
    mockStore.delete(id);
  }),
  get: vi.fn(async (_store: string, id: string) => mockStore.get(id)),
  put: vi.fn(async (_store: string, item: StoredItem) => {
    mockStore.set(item.id, item);
  }),
};

vi.mock("idb", () => ({
  openDB: vi.fn(async () => mockDB),
}));

beforeEach(() => {
  mockStore.clear();
  resetOfflineQueueConfig();
  vi.clearAllMocks();
});

describe("offlineQueue — queue size limit and overflow strategy", () => {
  it("enqueues normally when under maxSize", async () => {
    const id = await queuePayment({
      invoiceId: "inv-1",
      amount: 100n,
      sender: "GABC",
      timestamp: 1000,
    }, { maxSize: 2 });

    expect(id).toBeDefined();
    expect(mockStore.size).toBe(1);
  });

  it("drops oldest item when maxSize is reached and overflowStrategy is drop-oldest (default)", async () => {
    // Add two items (at limit 2)
    mockStore.set("p1", {
      id: "p1",
      invoiceId: "inv-1",
      amount: "100",
      sender: "GABC",
      timestamp: 1000,
      status: "pending",
    });
    mockStore.set("p2", {
      id: "p2",
      invoiceId: "inv-2",
      amount: "200",
      sender: "GABC",
      timestamp: 2000,
      status: "pending",
    });

    // Enqueue 3rd item with maxSize: 2 (default drop-oldest)
    const id3 = await queuePayment({
      invoiceId: "inv-3",
      amount: 300n,
      sender: "GABC",
      timestamp: 3000,
    }, { maxSize: 2, overflowStrategy: "drop-oldest" });

    expect(mockStore.size).toBe(2);
    expect(mockStore.has("p1")).toBe(false); // oldest evicted
    expect(mockStore.has("p2")).toBe(true);
    expect(mockStore.has(id3)).toBe(true);
  });

  it("throws OverflowError when maxSize is reached and overflowStrategy is throw", async () => {
    mockStore.set("p1", {
      id: "p1",
      invoiceId: "inv-1",
      amount: "100",
      sender: "GABC",
      timestamp: 1000,
      status: "pending",
    });
    mockStore.set("p2", {
      id: "p2",
      invoiceId: "inv-2",
      amount: "200",
      sender: "GABC",
      timestamp: 2000,
      status: "pending",
    });

    await expect(
      queuePayment(
        {
          invoiceId: "inv-3",
          amount: 300n,
          sender: "GABC",
          timestamp: 3000,
        },
        { maxSize: 2, overflowStrategy: "throw" }
      )
    ).rejects.toThrow(OverflowError);

    expect(mockStore.size).toBe(2);
    expect(mockStore.has("p1")).toBe(true);
    expect(mockStore.has("p2")).toBe(true);
  });

  it("respects global configureOfflineQueue options", async () => {
    configureOfflineQueue({ maxSize: 1, overflowStrategy: "throw" });

    mockStore.set("p1", {
      id: "p1",
      invoiceId: "inv-1",
      amount: "100",
      sender: "GABC",
      timestamp: 1000,
      status: "pending",
    });

    await expect(
      queuePayment({
        invoiceId: "inv-2",
        amount: 200n,
        sender: "GABC",
        timestamp: 2000,
      })
    ).rejects.toThrow(OverflowError);
  });
});
