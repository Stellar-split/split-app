import { vi, beforeEach, afterEach } from 'vitest';

// Mock context providers BEFORE any imports
vi.mock('@/contexts/AccessibilityContext', () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: () => ({
    fontScale: 100,
    setFontScale: () => {},
    reducedMotion: false,
    setReducedMotion: () => {},
    highContrast: 'normal',
    setHighContrast: () => {},
  }),
}));

vi.mock('@/contexts/WalletContext', () => ({
  WalletProvider: ({ children }: any) => children,
  useWalletContext: () => ({
    address: 'GTEST123456789',
    isConnected: false,
    connect: async () => {},
    disconnect: () => {},
    signTransaction: async (xdr: string) => ({ signedXdr: xdr }),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({
    toast: () => {},
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  }),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  Server: class MockServer {
    constructor() {}
    feeStats = async () => ({
      baseFee: '100',
      modeAcceptanceRate: '99',
      p10AcceptanceRate: '100',
      p20AcceptanceRate: '100',
      p30AcceptanceRate: '100',
      p40AcceptanceRate: '100',
      p50AcceptanceRate: '100',
      p60AcceptanceRate: '100',
      p70AcceptanceRate: '100',
      p80AcceptanceRate: '100',
      p90AcceptanceRate: '100',
      p99AcceptanceRate: '100',
    });
  },
  Keypair: { random: () => ({ publicKey: () => 'GTEST' }) },
  TransactionBuilder: class {},
  Networks: { PUBLIC_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015' },
  StrKey: {
    isValidEd25519PublicKey: () => true,
    encodeEd25519PublicKey: (buffer) => 'GTEST',
    decodeEd25519PublicKey: (key) => Buffer.alloc(32),
  },
}));

import '@testing-library/jest-dom/vitest';

// ============ GLOBAL TEST CONFIGURATION ============

// Clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  // Reset fetch mock
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
  // Reset DOM
  document.body.innerHTML = '';
});

// ============ WINDOW & DOM MOCKS ============

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '/',
    pathname: '/',
    search: '',
    hash: '',
    reload: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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
  takeRecords() { return []; }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(global, 'localStorage', {
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

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock crypto for tests
const cryptoMock = {
  subtle: {
    digest: vi.fn(async (algorithm: string, data: BufferSource) => {
      // Deterministic hash using Node.js crypto for testing
      try {
        const nodeCrypto = await import('crypto');
        const bytes = new Uint8Array(data as ArrayBuffer);
        const hash = nodeCrypto.createHash('sha256');
        hash.update(Buffer.from(bytes));
        const digest = hash.digest();
        return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
      } catch {
        // Fallback: return a consistent but different hash based on data
        const buffer = new ArrayBuffer(32);
        const view = new Uint8Array(buffer);
        const bytes = new Uint8Array(data as ArrayBuffer);
        for (let i = 0; i < 32; i++) {
          view[i] = (bytes[i % bytes.length] * 7 + i * 13) & 0xFF;
        }
        return buffer;
      }
    }),
  },
  getRandomValues: (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => {
    // Generate a random UUID v4-like string for testing
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
};

Object.defineProperty(global, 'crypto', {
  value: cryptoMock,
  writable: true,
});

// ============ MODULE MOCKS ============

vi.mock('@/lib/stellar', () => ({
  MAX_RECIPIENTS: 100,
  HORIZON_URL: 'https://horizon-testnet.stellar.org',
  splitClient: {
    getInvoice: vi.fn(async () => ({})),
    getGroupStatus: vi.fn(async () => ({})),
    submitTransaction: vi.fn(async () => ({ id: 'tx123' })),
  },
}));

vi.mock('@/lib/freighter', () => ({
  getFreighterPublicKey: vi.fn(async () => 'GTEST'),
  signTransaction: vi.fn(async (xdr) => ({ signedXdr: xdr })),
}));

vi.mock('@/lib/ipfs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ipfs')>();
  return {
    ...actual,
    uploadToIPFS: vi.fn(async () => 'QmMocked'),
    uploadToIpfs: vi.fn(async () => 'QmMocked'),
    fetchFromIPFS: vi.fn(async () => ({})),
    getIpfsUrl: vi.fn((cid: string) => `https://ipfs.io/ipfs/${cid}`),
    isValidCid: vi.fn((cid: string) => /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)),
    mockIpfsUpload: vi.fn(async () => 'QmMocked'),
  };
});

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn(async () => ({})),
}));

// Context mocks are now in src/__mocks__/contexts/ and src/__mocks__/context/
// vitest automatically uses these mock files

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(async () => {}),
    replace: vi.fn(async () => {}),
    prefetch: vi.fn(async () => {}),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

vi.mock('next/link', () => {
  const React = require('react');
  return {
    default: ({ children, href }: any) => React.createElement('a', { href }, children),
  };
});

vi.mock('next/image', () => {
  const React = require('react');
  return {
    default: ({ src, alt }: any) => React.createElement('img', { src, alt }),
  };
});

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(async () => false),
  getPublicKey: vi.fn(async () => null),
  signTransaction: vi.fn(async (xdr) => ({ signedXdr: xdr })),
}));

vi.mock('@/lib/release', () => ({
  transitionToReleased: vi.fn(async () => ({})),
  transitionToDisputed: vi.fn(async () => ({})),
  getReleaseCheck: vi.fn(async () => ({})),
  canTransition: vi.fn(() => true),
}));

vi.mock('@/lib/arbitration', () => ({
  createDispute: vi.fn(async () => ({})),
  getArbitratorByAddress: vi.fn(async () => null),
}));

vi.mock('@/lib/group', () => ({
  getGroupMembers: vi.fn(async () => []),
  createGroup: vi.fn(async () => ({})),
  findGroup: vi.fn(async () => null),
}));

vi.mock('@/lib/session', () => ({
  startSession: vi.fn(async () => ({})),
  endSession: vi.fn(async () => ({})),
  checkSession: vi.fn(async () => ({ active: false })),
}));

vi.mock('@/lib/crypto', () => ({
  encryptData: vi.fn(async () => 'encrypted'),
  decryptData: vi.fn(async () => ({})),
  generateKey: vi.fn(async () => 'key'),
}));

vi.mock('@/lib/notify', () => ({
  notify: vi.fn(() => Promise.resolve()),
  notifyUser: vi.fn(async () => ({})),
}));

vi.mock('@/lib/rpc', () => ({
  RPC_URL: 'https://rpc-testnet.example.com',
  callRpc: vi.fn(async () => ({})),
}));

vi.mock('@/lib/biometric', () => ({
  isBiometricAvailable: vi.fn(async () => false),
  authenticate: vi.fn(async () => false),
  register: vi.fn(async () => ({})),
}));

vi.mock('@/lib/lock', () => ({
  lockSession: vi.fn(async () => ({})),
  unlockSession: vi.fn(async () => ({})),
  isSessionLocked: vi.fn(() => false),
}));

vi.mock('@/hooks/useEventSource', () => ({
  useEventSource: vi.fn(() => ({ events: [], close: vi.fn() })),
}));

vi.mock('@/hooks/useContrastCheck', () => ({
  useContrastCheck: vi.fn((color) => ({ passes: true, ratio: 4.5 })),
}));

vi.mock('@/lib/api', () => ({
  apiCall: vi.fn(async () => ({})),
  apiGet: vi.fn(async () => ({})),
  apiPost: vi.fn(async () => ({})),
  apiPut: vi.fn(async () => ({})),
  apiDelete: vi.fn(async () => ({})),
}));

vi.mock('@/lib/data', () => ({
  fetchData: vi.fn(async () => []),
  saveData: vi.fn(async () => ({})),
  deleteData: vi.fn(async () => true),
  updateData: vi.fn(async () => ({})),
}));

vi.mock('@/lib/auth', () => ({
  login: vi.fn(async () => ({ token: 'mock-token' })),
  logout: vi.fn(async () => ({})),
  getCurrentUser: vi.fn(async () => null),
  refreshToken: vi.fn(async () => ({ token: 'mock-token' })),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(() => {}),
  cacheClear: vi.fn(() => {}),
  cacheInvalidate: vi.fn(() => {}),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/lib/error-handler', () => ({
  handleError: vi.fn(() => ({})),
  logError: vi.fn(() => {}),
  captureException: vi.fn(() => {}),
}));

vi.mock('@/lib/tracking', () => ({
  trackEvent: vi.fn(() => {}),
  trackPage: vi.fn(() => {}),
  trackUser: vi.fn(() => {}),
}));

vi.mock('@/lib/rateLimit', () => ({
  isRateLockExpired: vi.fn(() => false),
  getRateLimitKey: vi.fn(() => 'key'),
  setRateLimit: vi.fn(() => {}),
}));

vi.mock('@/lib/observable', () => ({
  createObservable: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

vi.mock('@/lib/stream', () => ({
  createStream: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() })),
  Stream: class { on = vi.fn(); off = vi.fn(); emit = vi.fn(); },
}));

vi.mock('@/lib/queue', () => ({
  createQueue: vi.fn(() => ({ push: vi.fn(), pop: vi.fn(), size: 0 })),
  enqueue: vi.fn(async () => ({})),
  dequeue: vi.fn(async () => null),
}));

vi.mock('@/lib/worker', () => ({
  startWorker: vi.fn(async () => ({})),
  stopWorker: vi.fn(async () => ({})),
  postMessage: vi.fn(() => {}),
}));

vi.mock('@/lib/defaults', () => ({
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_RETRY_COUNT: 3,
  DEFAULT_BUFFER_SIZE: 100,
}));

vi.mock('@/lib/constants', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_VERSION: 'v1',
  MAX_RETRIES: 3,
}));

vi.mock('@/lib/dom', () => ({
  createElement: vi.fn((tag) => document.createElement(tag)),
  querySelector: vi.fn(() => null),
  getElementById: vi.fn(() => null),
  renderToDOM: vi.fn(() => {}),
}));

vi.mock('@/lib/events', () => ({
  addEventListener: vi.fn(() => {}),
  removeEventListener: vi.fn(() => {}),
  dispatchEvent: vi.fn(() => true),
  on: vi.fn(() => {}),
  off: vi.fn(() => {}),
  emit: vi.fn(() => {}),
}));

// ============ GLOBAL FETCH MOCK ============

global.fetch = vi.fn(async (url: string, options?: any) => {
  // Default mock responses
  if (typeof url === 'string' && url.includes('/api/')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    blob: async () => new Blob(),
  };
}) as any;
