/**
 * Stub for retry metrics — provides a reset function used by vitest.setup.ts
 * between tests.
 */

let _callCount = 0;
let _failureCount = 0;

export const retryMetrics = {
  increment() {
    _callCount++;
  },
  failure() {
    _failureCount++;
  },
  get callCount() {
    return _callCount;
  },
  get failureCount() {
    return _failureCount;
  },
  reset() {
    _callCount = 0;
    _failureCount = 0;
  },
};

export function resetRetryMetrics(): void {
  retryMetrics.reset();
}
