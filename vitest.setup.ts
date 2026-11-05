import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Setup fake timers for all tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

// Mock all external dependencies
vi.mock('@/lib/stellar', () => ({
  splitClient: { getInvoice: vi.fn(async () => ({})) },
}));

vi.mock('@/lib/freighter', () => ({
  getFreighterPublicKey: vi.fn(async () => 'GTEST'),
}));

vi.mock('@/lib/ipfs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ipfs')>();
  return {
    ...actual,
    uploadToIPFS: vi.fn(async () => 'QmMocked'),
    uploadToIpfs: vi.fn(async () => 'QmMocked'),
    fetchFromIPFS: vi.fn(async () => ({})),
  };
});

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn(async () => ({})),
}));

vi.mock('@/lib/accessibility', () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: vi.fn(() => ({})),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(() => Promise.resolve()),
    replace: vi.fn(() => Promise.resolve()),
    prefetch: vi.fn(() => Promise.resolve()),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '/',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Global test setup
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as any;
