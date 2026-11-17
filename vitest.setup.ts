import { vi, beforeEach, afterEach } from 'vitest';
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
  splitClient: {
    getInvoice: vi.fn(async () => ({})),
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

vi.mock('@/contexts/AccessibilityContext', () => {
  const React = require('react');

  const mockContext = {
    fontScale: 100 as const,
    setFontScale: () => {},
    reducedMotion: false,
    setReducedMotion: () => {},
    highContrast: 'normal' as const,
    setHighContrast: () => {},
  };

  return {
    AccessibilityProvider: ({ children }: any) => React.createElement(React.Fragment, {}, children),
    useAccessibility: () => mockContext,
  };
});

vi.mock('@/contexts/WalletContext', () => {
  const React = require('react');

  return {
    WalletProvider: ({ children }: any) => React.createElement(React.Fragment, {}, children),
    useWalletContext: () => ({
      address: 'GTEST123456789',
      isConnected: false,
      connect: async () => {},
      disconnect: () => {},
      signTransaction: async (xdr: string) => ({ signedXdr: xdr }),
    }),
  };
});

vi.mock('@/context/ToastContext', () => {
  const React = require('react');

  return {
    ToastProvider: ({ children }: any) => React.createElement(React.Fragment, {}, children),
    useToast: () => ({
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }),
  };
});

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
