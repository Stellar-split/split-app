import * as Sentry from "@sentry/nextjs";
import { initPerformanceMonitoring, onPerformanceMetric, isRegression } from "./src/lib/performanceMonitoring";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
  });
}

// Core Web Vitals collection + budget-regression reporting (see
// src/lib/performanceMonitoring.ts and docs/PERFORMANCE.md).
onPerformanceMetric((metric) => {
  if (dsn) {
    Sentry.setMeasurement(metric.name, metric.value, metric.name === "CLS" ? "" : "millisecond");
  }
  if (isRegression(metric.name, metric.value)) {
    if (dsn) {
      Sentry.captureMessage(`Performance budget regression: ${metric.name}=${metric.value} on ${metric.path}`, "warning");
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[perf] budget regression: ${metric.name}=${metric.value} on ${metric.path}`);
    }
  }
});
initPerformanceMonitoring();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Analytics consent state.
 * Analytics must never run unless the user has explicitly granted consent.
 */
const ANALYTICS_CONSENT_KEY = "analytics-consent";

type AnalyticsConsent = "granted" | "denied" | "unknown";

function readConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unknown";
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
    return "unknown";
  } catch {
    // localStorage may be unavailable (e.g. privacy mode); treat as no consent.
    return "unknown";
  }
}

function hasConsent(): boolean {
  return readConsent() === "granted";
}

/**
 * Minimal analytics client interface. The concrete provider is initialized
 * lazily and only after consent is granted.
 */
interface AnalyticsClient {
  init: (options: { dsn?: string; sampleRate?: number }) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  flush: () => void;
}

let analyticsClient: AnalyticsClient | null = null;
let analyticsInitialized = false;
let flushHandlerAttached = false;

/**
 * Queue of events captured before the provider finished initializing.
 * Kept small and bounded to avoid unbounded memory growth.
 */
const MAX_QUEUE_SIZE = 100;
const eventQueue: Array<{ event: string; properties?: Record<string, unknown> }> = [];

function enqueue(event: string, properties?: Record<string, unknown>): void {
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    eventQueue.shift();
  }
  eventQueue.push({ event, properties });
}

function drainQueue(client: AnalyticsClient): void {
  while (eventQueue.length > 0) {
    const item = eventQueue.shift();
    if (item) {
      try {
        client.track(item.event, item.properties);
      } catch {
        // Never let analytics failures break the app.
      }
    }
  }
}

/**
 * Lazily load and initialize the analytics provider. This is intentionally
 * non-blocking: it is scheduled on an idle callback (or a microtask fallback)
 * so it never impacts initial page performance.
 */
function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (analyticsInitialized) return;
  if (!hasConsent()) return;

  analyticsInitialized = true;

  const start = () => {
    // Re-check consent in case it was revoked before the idle callback ran.
    if (!hasConsent()) {
      analyticsInitialized = false;
      return;
    }

    import("./analytics-client")
      .then((mod) => {
        const client = mod.createAnalyticsClient();
        analyticsClient = client;
        client.init({
          dsn: process.env.NEXT_PUBLIC_ANALYTICS_DSN,
          sampleRate: 1.0,
        });
        drainQueue(client);
      })
      .catch(() => {
        // Provider failed to load; reset so a later attempt can retry.
        analyticsInitialized = false;
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 2000 });
  } else {
    window.setTimeout(start, 0);
  }
}

/**
 * Track a user action. No-op unless consent has been granted.
 * Safe to call from anywhere in the client bundle.
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;

  if (analyticsClient) {
    try {
      analyticsClient.track(event, properties);
    } catch {
      // Swallow analytics errors.
    }
    return;
  }

  enqueue(event, properties);
  // Ensure the provider is (or will be) initialized.
  initAnalytics();
}

/**
 * Flush any queued events. Intended to be called on page hide / unload so
 * events are not lost. Uses `visibilitychange` + `pagehide` for reliability
 * across browsers (including bfcache).
 */
export function flushAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;

  if (analyticsClient) {
    try {
      analyticsClient.flush();
    } catch {
      // Swallow analytics errors.
    }
  }
}

function attachFlushHandler(): void {
  if (typeof window === "undefined") return;
  if (flushHandlerAttached) return;
  flushHandlerAttached = true;

  const onPageHide = () => {
    flushAnalytics();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushAnalytics();
    }
  };

  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("visibilitychange", onVisibilityChange);
}

// Initialize analytics on the client, gated by consent and non-blocking.
if (typeof window !== "undefined") {
  attachFlushHandler();
  initAnalytics();
}