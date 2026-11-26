import { beforeAll, afterEach, vi } from 'vitest';

// AccessibilityContext is already mocked in vitest.setup.ts with the shape
// that matches the real context (fontScale/reducedMotion/highContrast as a
// string); do not re-mock it here with a different, stale shape.

beforeAll(() => {
  // Setup global mocks
});

afterEach(() => {
  vi.clearAllMocks();
});
