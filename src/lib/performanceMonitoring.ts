/**
 * performanceMonitoring.ts
 *
 * Lightweight Core Web Vitals collection + performance-budget regression
 * detection, with no third-party runtime dependency (uses the native
 * PerformanceObserver / Navigation Timing APIs only).
 *
 * Wired up from `instrumentation-client.ts` via `initPerformanceMonitoring()`.
 */

export type MetricName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

export interface PerformanceMetric {
  name: MetricName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
  path: string;
}

export type MetricReporter = (metric: PerformanceMetric) => void;

/**
 * Performance budgets, aligned with the thresholds Google's web-vitals
 * library uses for "good" vs "needs-improvement" vs "poor".
 * Values are in milliseconds, except CLS which is a unitless layout-shift
 * score.
 */
export const PERFORMANCE_BUDGETS: Record<MetricName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

export function rateMetric(name: MetricName, value: number): PerformanceMetric["rating"] {
  const budget = PERFORMANCE_BUDGETS[name];
  if (value <= budget.good) return "good";
  if (value <= budget.poor) return "needs-improvement";
  return "poor";
}

/**
 * Returns true when a metric value breaches its budget's "poor" threshold —
 * the signal used for automated regression detection (e.g. in CI or a
 * synthetic monitoring job).
 */
export function isRegression(name: MetricName, value: number): boolean {
  return value > PERFORMANCE_BUDGETS[name].poor;
}

const listeners = new Set<MetricReporter>();

/** Subscribe to collected metrics (e.g. to forward them to Sentry/analytics). */
export function onPerformanceMetric(reporter: MetricReporter): () => void {
  listeners.add(reporter);
  return () => listeners.delete(reporter);
}

function emit(name: MetricName, value: number) {
  const metric: PerformanceMetric = {
    name,
    value,
    rating: rateMetric(name, value),
    timestamp: Date.now(),
    path: typeof window !== "undefined" ? window.location.pathname : "",
  };
  listeners.forEach((reporter) => {
    try {
      reporter(metric);
    } catch {
      // never let a reporter crash the page
    }
  });
}

let initialized = false;

/**
 * Starts collecting Core Web Vitals in the browser via PerformanceObserver.
 * Safe to call multiple times (no-op after the first call) and safe to call
 * on the server (no-op, since PerformanceObserver doesn't exist there).
 */
export function initPerformanceMonitoring(): void {
  if (initialized) return;
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  initialized = true;

  // Time to First Byte, from Navigation Timing.
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      emit("TTFB", nav.responseStart - nav.requestStart);
    }
  } catch {
    // ignore
  }

  // First Contentful Paint.
  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          emit("FCP", entry.startTime);
        }
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });
  } catch {
    // ignore unsupported entry types
  }

  // Largest Contentful Paint — keep reporting the latest candidate until the
  // page is hidden/unloaded, per the standard LCP collection pattern.
  try {
    let lastLCP = 0;
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) lastLCP = last.startTime;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    const flushLCP = () => {
      if (lastLCP > 0) emit("LCP", lastLCP);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushLCP();
    });
    window.addEventListener("pagehide", flushLCP, { once: true });
  } catch {
    // ignore
  }

  // Cumulative Layout Shift.
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      emit("CLS", clsValue);
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    // ignore
  }

  // Interaction to Next Paint (approximated via `event` timing entries).
  try {
    let worstINP = 0;
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { duration: number }>) {
        if (entry.duration > worstINP) {
          worstINP = entry.duration;
          emit("INP", worstINP);
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {
    // event timing isn't supported everywhere; silently skip
  }
}
