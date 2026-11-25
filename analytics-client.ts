/**
 * Analytics client provider — loaded dynamically only after consent is granted.
 * Intentionally minimal to keep the main bundle lean.
 */

export interface AnalyticsClient {
  init: (options: { dsn?: string; sampleRate?: number }) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  flush: () => void;
}

export function createAnalyticsClient(): AnalyticsClient {
  return {
    init() {
      // No-op in stub implementation
    },
    track() {
      // No-op in stub implementation
    },
    flush() {
      // No-op in stub implementation
    },
  };
}
