import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock all external dependencies
vi.mock('@/lib/stellar', () => ({
  splitClient: { getInvoice: vi.fn(async () => ({})) },
}));

vi.mock('@/lib/freighter', () => ({
  getFreighterPublicKey: vi.fn(async () => 'GTEST'),
}));

vi.mock('@/lib/ipfs', () => ({
  uploadToIPFS: vi.fn(async () => 'QmMocked'),
  uploadToIpfs: vi.fn(async () => 'QmMocked'),
  fetchFromIPFS: vi.fn(async () => ({})),
  getIpfsUrl: vi.fn((cid: string) => `https://ipfs.io/ipfs/${cid}`),
  isValidCid: vi.fn((cid: string) => /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)),
  mockIpfsUpload: vi.fn(async () => 'QmMocked'),
  IPFS_GATEWAY: 'https://ipfs.io',
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
