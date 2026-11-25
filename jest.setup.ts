import "@testing-library/jest-dom";

/**
 * Global Jest setup.
 *
 * Provides reliable mocks for browser APIs used by the error handling,
 * retry, and offline queue features so tests run deterministically in jsdom.
 */

/* -------------------------------------------------------------------------- */
/*                              IndexedDB mock                                */
/* -------------------------------------------------------------------------- */

type StoreRecord = Record<string, unknown>;

class MockIDBRequest<T = unknown> {
  result: T | undefined = undefined;
  error: Error | null = null;
  readyState: "pending" | "done" = "pending";
  source: unknown = null;
  transaction: unknown = null;
  onsuccess: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (type === "success") this.onsuccess = listener;
    if (type === "error") this.onerror = listener;
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    if (type === "success" && this.onsuccess === listener) this.onsuccess = null;
    if (type === "error" && this.onerror === listener) this.onerror = null;
  }
}

class MockIDBObjectStore {
  constructor(
    private readonly data: Map<string, StoreRecord>,
    private readonly name: string,
  ) {}

  private schedule<T>(request: MockIDBRequest<T>, fn: () => T): MockIDBRequest<T> {
    queueMicrotask(() => {
      try {
        request.result = fn();
        request.readyState = "done";
        request.onsuccess?.({ target: request });
      } catch (err) {
        request.error = err as Error;
        request.readyState = "done";
        request.onerror?.({ target: request });
      }
    });
    return request;
  }

  put(value: StoreRecord, key?: string): MockIDBRequest<string> {
    const request = new MockIDBRequest<string>();
    const recordKey = key ?? (value.id as string) ?? String(Date.now());
    return this.schedule(request, () => {
      this.data.set(recordKey, { ...value });
      return recordKey;
    });
  }

  add(value: StoreRecord, key?: string): MockIDBRequest<string> {
    return this.put(value, key);
  }

  get(key: string): MockIDBRequest<StoreRecord | undefined> {
    const request = new MockIDBRequest<StoreRecord | undefined>();
    return this.schedule(request, () => this.data.get(key));
  }

  getAll(): MockIDBRequest<StoreRecord[]> {
    const request = new MockIDBRequest<StoreRecord[]>();
    return this.schedule(request, () => Array.from(this.data.values()));
  }

  delete(key: string): MockIDBRequest<undefined> {
    const request = new MockIDBRequest<undefined>();
    return this.schedule(request, () => {
      this.data.delete(key);
      return undefined;
    });
  }

  clear(): MockIDBRequest<undefined> {
    const request = new MockIDBRequest<undefined>();
    return this.schedule(request, () => {
      this.data.clear();
      return undefined;
    });
  }

  count(): MockIDBRequest<number> {
    const request = new MockIDBRequest<number>();
    return this.schedule(request, () => this.data.size);
  }

  createIndex(): unknown {
    return {};
  }

  index(): unknown {
    return {};
  }

  get name_(): string {
    return this.name;
  }
}

class MockIDBTransaction {
  oncomplete: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onabort: ((event: unknown) => void) | null = null;
  error: Error | null = null;
  mode: string;

  constructor(
    private readonly db: MockIDBDatabase,
    storeNames: string | string[],
    mode: string = "readonly",
  ) {
    this.mode = mode;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    queueMicrotask(() => this.oncomplete?.({ target: this }));
  }

  storeNames: string[];

  objectStore(name: string): MockIDBObjectStore {
    return this.db.getStore(name);
  }

  abort(): void {
    this.onabort?.({ target: this });
  }
}

class MockIDBDatabase {
  readonly name: string;
  readonly version: number;
  readonly objectStoreNames: { contains: (name: string) => boolean };
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onversionchange: ((event: unknown) => void) | null = null;

  private readonly stores = new Map<string, Map<string, StoreRecord>>();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = {
      contains: (storeName: string) => this.stores.has(storeName),
    };
  }

  getStore(name: string): MockIDBObjectStore {
    let data = this.stores.get(name);
    if (!data) {
      data = new Map<string, StoreRecord>();
      this.stores.set(name, data);
    }
    return new MockIDBObjectStore(data, name);
  }

  createObjectStore(name: string): MockIDBObjectStore {
    return this.getStore(name);
  }

  deleteObjectStore(name: string): void {
    this.stores.delete(name);
  }

  transaction(
    storeNames: string | string[],
    mode: string = "readonly",
  ): MockIDBTransaction {
    return new MockIDBTransaction(this, storeNames, mode);
  }

  close(): void {
    this.onclose?.();
  }
}

class MockIDBOpenDBRequest extends MockIDBRequest<MockIDBDatabase> {
  onupgradeneeded: ((event: unknown) => void) | null = null;
  onblocked: ((event: unknown) => void) | null = null;
}

const openDatabases = new Map<string, MockIDBDatabase>();

const mockIndexedDB = {
  open(name: string, version: number = 1): MockIDBOpenDBRequest {
    const request = new MockIDBOpenDBRequest();
    queueMicrotask(() => {
      try {
        const existing = openDatabases.get(name);
        const db = existing ?? new MockIDBDatabase(name, version);
        const isNew = !existing;
        openDatabases.set(name, db);
        request.result = db;
        if (isNew) {
          request.onupgradeneeded?.({ target: request, oldVersion: 0, newVersion: version });
        }
        request.readyState = "done";
        request.onsuccess?.({ target: request });
      } catch (err) {
        request.error = err as Error;
        request.readyState = "done";
        request.onerror?.({ target: request });
      }
    });
    return request;
  },

  deleteDatabase(name: string): MockIDBRequest<undefined> {
    const request = new MockIDBRequest<undefined>();
    queueMicrotask(() => {
      openDatabases.delete(name);
      request.result = undefined;
      request.readyState = "done";
      request.onsuccess?.({ target: request });
    });
    return request;
  },

  cmp(a: unknown, b: unknown): number {
    if (a === b) return 0;
    return (a as number) < (b as number) ? -1 : 1;
  },
};

Object.defineProperty(globalThis, "indexedDB", {
  value: mockIndexedDB,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "IDBKeyRange", {
  value: {
    only: (value: unknown) => ({ only: value }),
    lowerBound: (value: unknown) => ({ lowerBound: value }),
    upperBound: (value: unknown) => ({ upperBound: value }),
    bound: (lower: unknown, upper: unknown) => ({ lower, upper }),
  },
  writable: true,
  configurable: true,
});

/* -------------------------------------------------------------------------- */
/*                          navigator.onLine mock                             */
/* -------------------------------------------------------------------------- */

let onlineState = true;

Object.defineProperty(globalThis.navigator, "onLine", {
  get: () => onlineState,
  configurable: true,
});

/**
 * Test helper: set the simulated connectivity state and dispatch the
 * corresponding online/offline event on window.
 */
export function setOnlineState(online: boolean): void {
  onlineState = online;
  const event = new Event(online ? "online" : "offline");
  window.dispatchEvent(event);
}

Object.defineProperty(globalThis, "__setOnlineState", {
  value: setOnlineState,
  writable: true,
  configurable: true,
});

/* -------------------------------------------------------------------------- */
/*                          online/offline events                             */
/* -------------------------------------------------------------------------- */

// jsdom does not implement online/offline events; ensure listeners work.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    onlineState = true;
  });
  window.addEventListener("offline", () => {
    onlineState = false;
  });
}

/* -------------------------------------------------------------------------- */
/*                                  fetch mock                                */
/* -------------------------------------------------------------------------- */

type FetchMockHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> | Response;

const defaultFetchHandler: FetchMockHandler = () =>
  Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

let fetchHandler: FetchMockHandler = defaultFetchHandler;

const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
  Promise.resolve(fetchHandler(input, init)),
);

Object.defineProperty(globalThis, "fetch", {
  value: fetchMock,
  writable: true,
  configurable: true,
});

/**
 * Test helper: override the fetch implementation for the current test.
 */
export function mockFetch(handler: FetchMockHandler): void {
  fetchHandler = handler;
}

/**
 * Test helper: reset fetch to the default successful response.
 */
export function resetFetchMock(): void {
  fetchHandler = defaultFetchHandler;
  fetchMock.mockClear();
}

Object.defineProperty(globalThis, "__mockFetch", {
  value: mockFetch,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "__resetFetchMock", {
  value: resetFetchMock,
  writable: true,
  configurable: true,
});

/* -------------------------------------------------------------------------- */
/*                              Global resets                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  onlineState = true;
  resetFetchMock();
});

afterEach(() => {
  jest.clearAllMocks();
});