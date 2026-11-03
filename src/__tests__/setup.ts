import { beforeAll, afterEach, vi } from 'vitest';

// Mock IPFS
vi.mock('@/lib/ipfs', () => ({
  uploadToIPFS: vi.fn(async () => 'QmMocked'),
  fetchFromIPFS: vi.fn(async () => ({})),
}));

// Mock Accessibility
vi.mock('@/lib/accessibility', () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: vi.fn(() => ({})),
}));

beforeAll(() => {
  // Setup global mocks
});

afterEach(() => {
  vi.clearAllMocks();
});
