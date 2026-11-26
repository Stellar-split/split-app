import { vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Wrap the real crypto.subtle.digest in a vi.fn() so individual tests can
// override it with mockResolvedValue(Once), while other code that relies on
// real hashing (accessCode, confidential, csrf, auth token routes) keeps
// working by default.
if (globalThis.crypto?.subtle?.digest) {
  const realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
  globalThis.crypto.subtle.digest = vi.fn(realDigest) as typeof globalThis.crypto.subtle.digest;
}

// ============ CONTEXT MOCKS (before any imports that use them) ============

vi.mock("@/contexts/AccessibilityContext", () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: () => ({
    fontScale: 100,
    setFontScale: () => {},
    reducedMotion: false,
    setReducedMotion: () => {},
    highContrast: "normal",
    setHighContrast: () => {},
  }),
}));

vi.mock("@/contexts/WalletContext", () => ({
  WalletProvider: ({ children }: any) => children,
  useWalletContext: () => ({
    address: "GTEST123456789",
    isConnected: false,
    connect: async () => {},
    disconnect: () => {},
    signTransaction: async (xdr: string) => ({ signedXdr: xdr }),
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  ToastProvider: ({ children }: { children: unknown }) => children,
  useToast: () => ({
    notify: vi.fn(),
    showToast: vi.fn(),
  }),
}));

// ============ MODULE MOCKS ============

vi.mock("@/lib/stellar", () => ({
  RPC_URL: "https://soroban-testnet.stellar.org",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  MAX_RECIPIENTS: 10,
  splitClient: {
    getInvoice: vi.fn(async () => ({})),
    getGroupStatus: vi.fn(async () => null),
    submitTransaction: vi.fn(async () => ({ id: "tx123" })),
  },
  resolveFederationAddress: vi.fn(async () => null),
}));

vi.mock("@/lib/freighter", () => ({
  getFreighterPublicKey: vi.fn(async () => "GTEST"),
  signTransaction: vi.fn(async (xdr: string) => ({ signedXdr: xdr })),
  connectFreighter: vi.fn(async () => "GTEST"),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => false),
  getPublicKey: vi.fn(async () => null),
  signTransaction: vi.fn(async (xdr: string) => ({ signedXdr: xdr })),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  // Use the real StrKey (and everything else) so encode/decode/isValid* stay
  // correct and consistent with each other; only Server/Keypair/TransactionBuilder
  // are replaced to avoid real network calls / keypair generation in tests.
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Server: class MockServer {
      constructor() {}
      feeStats = async () => ({
        baseFee: "100",
        modeAcceptanceRate: "99",
        p10AcceptanceRate: "100",
        p20AcceptanceRate: "100",
        p30AcceptanceRate: "100",
        p40AcceptanceRate: "100",
        p50AcceptanceRate: "100",
        p60AcceptanceRate: "100",
        p70AcceptanceRate: "100",
        p80AcceptanceRate: "100",
        p90AcceptanceRate: "100",
        p99AcceptanceRate: "100",
      });
    },
    Keypair: { random: () => ({ publicKey: () => "GTEST" }) },
    TransactionBuilder: class {},
    Networks: { PUBLIC_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015" },
  };
});

vi.mock("@/lib/ipfs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ipfs")>();
  // Let real uploadToIPFS use mocked fetch, only mock non-fetch functions
  return {
    ...actual,
    fetchFromIPFS: vi.fn(async () => ({})),
  };
});

const mockRouterInstance = {
  push: vi.fn().mockResolvedValue(undefined),
  replace: vi.fn().mockResolvedValue(undefined),
  prefetch: vi.fn().mockResolvedValue(undefined),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mockRouterInstance),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/link", () => {
  const React = require("react");
  return {
    default: ({ children, href, ...rest }: { children: unknown; href: string } & Record<string, unknown>) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

vi.mock("next/image", () => {
  const React = require("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      React.createElement("img", { src, alt }),
  };
});

// ============ GLOBAL TEST CONFIGURATION ============

// Use real timers by default for better async handling
beforeEach(() => {
  vi.useRealTimers();
  global.fetch = vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/api/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
        blob: async () => new Blob(),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
      blob: async () => new Blob(),
    };
  }) as unknown as typeof fetch;
  vi.mocked(mockRouterInstance.push).mockClear();
  vi.mocked(mockRouterInstance.replace).mockClear();
  vi.mocked(mockRouterInstance.prefetch).mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

// ============ WINDOW & DOM MOCKS ============

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost/",
    origin: "http://localhost",
    pathname: "/",
    search: "",
    hash: "",
    reload: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// Mock window.matchMedia
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

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// ============ GLOBAL MOCKS ============

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

// sessionStorage mock
const sessionStorageMock = (() => {
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

Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });
Object.defineProperty(global, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});
