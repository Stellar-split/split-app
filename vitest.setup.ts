import { vi } from 'vitest';

// Mock all external dependencies
vi.mock('@/lib/stellar', () => ({
  splitClient: { getInvoice: vi.fn(async () => ({})) },
}));

vi.mock('@/lib/freighter', () => ({
  getFreighterPublicKey: vi.fn(async () => 'GTEST'),
}));

vi.mock('@/lib/ipfs', () => ({
  uploadToIPFS: vi.fn(async () => 'QmMocked'),
  fetchFromIPFS: vi.fn(async () => ({})),
}));

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn(async () => ({})),
}));

vi.mock('@/lib/accessibility', () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: vi.fn(() => ({})),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

// Global test setup
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as any;
