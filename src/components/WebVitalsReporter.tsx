"use client";

import { useReportWebVitals } from "next/web-vitals";
import * as Sentry from "@sentry/nextjs";

/**
 * Forwards Core Web Vitals (CLS, LCP, FID/INP, TTFB, FCP) to Sentry as
 * measurements on the active span, so real-user performance can be
 * monitored and benchmarked over time alongside the existing Sentry
 * tracing (tracesSampleRate) setup.
 */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    Sentry.setMeasurement(metric.name, metric.value, "millisecond");
  });

  return null;
}
