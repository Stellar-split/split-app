import { beforeAll, afterEach, vi } from 'vitest';

// Mock Accessibility context - wrap components properly
vi.mock('@/contexts/AccessibilityContext', () => ({
  AccessibilityProvider: ({ children }: any) => children,
  useAccessibility: vi.fn(() => ({
    fontSize: 1,
    setFontSize: vi.fn(),
    reducedMotion: false,
    setReducedMotion: vi.fn(),
    highContrast: false,
    setHighContrast: vi.fn(),
  })),
}));

beforeAll(() => {
  // Setup global mocks
});

afterEach(() => {
  vi.clearAllMocks();
});
