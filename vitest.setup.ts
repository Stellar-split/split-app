import { vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// ============ MODULE MOCKS ============

vi.mock("@/lib/stellar", () => ({
  RPC_URL: "https://soroban-testnet.stellar.org",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  splitClient: {
    getInvoice: vi.fn(async () => ({})),
    submitTransaction: vi.fn(async () => ({ id: "tx123" })),
  },
}));

vi.mock("@/lib/freighter", () => ({
  getFreighterPublicKey: vi.fn(async () => "GTEST"),
  signTransaction: vi.fn(async (xdr: string) => ({ signedXdr: xdr })),
  connectFreighter: vi.fn(async () => "GTEST"),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

vi.mock("@/context/ToastContext", () => ({
  ToastProvider: ({ children }: { children: unknown }) => children,
  useToast: () => ({
    notify: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/link", () => {
  const React = require("react");
  return {
    default: ({ children, href }: { children: unknown; href: string }) =>
      React.createElement("a", { href }, children),
  };
});

vi.mock("next/image", () => {
  const React = require("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => false),
  getPublicKey: vi.fn(async () => null),
  signTransaction: vi.fn(async (xdr: string) => ({ signedXdr: xdr })),
}));

// ============ GLOBAL MOCKS ============

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;

global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });
Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  vi.useRealTimers();
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  })) as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});
