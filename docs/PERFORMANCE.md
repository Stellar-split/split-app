# Performance benchmarking and monitoring

## Overview

Performance is tracked at two levels:

1. **Real User Monitoring (RUM)** — Core Web Vitals (LCP, CLS, INP, FCP, TTFB)
   are collected in production via `src/lib/performanceMonitoring.ts`, wired
   up from `instrumentation-client.ts`. Metrics are forwarded to Sentry as
   measurements (`Sentry.setMeasurement`) when `NEXT_PUBLIC_SENTRY_DSN` is
   configured, giving per-metric trends/dashboards for free in the Sentry
   Performance UI.
2. **Synthetic / lab monitoring in CI** — [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
   (`.github/workflows/performance.yml`, config in `lighthouserc.json`) runs
   a production build and audits the home page, dashboard, and new-invoice
   pages on every PR and on pushes to `main`.

## Baseline metrics / budgets

Budgets mirror the thresholds the Web Vitals program uses for "good" vs
"needs-improvement" vs "poor", defined in `PERFORMANCE_BUDGETS` in
`src/lib/performanceMonitoring.ts`:

| Metric | Good | Poor (regression) |
| --- | --- | --- |
| LCP | ≤ 2500ms | > 4000ms |
| CLS | ≤ 0.1 | > 0.25 |
| INP | ≤ 200ms | > 500ms |
| FCP | ≤ 1800ms | > 3000ms |
| TTFB | ≤ 800ms | > 1800ms |

Lighthouse CI enforces a parallel, lab-measured set of budgets in
`lighthouserc.json` (performance score ≥ 0.8, LCP ≤ 4000ms, CLS ≤ 0.25, TBT ≤
600ms), run 3x per URL and averaged to reduce noise.

## Regression detection

`isRegression(name, value)` in `src/lib/performanceMonitoring.ts` flags any
RUM metric that crosses its "poor" threshold. In production this triggers a
`Sentry.captureMessage` warning (tagged with the metric and page path); in
CI, Lighthouse CI's `assert` block fails the build outright when a budget is
violated (`error` level assertions) or annotates the PR (`warn` level
assertions).

## Dashboards

- **Sentry → Performance** shows trends for each Web Vital measurement over
  time, filterable by release and page path.
- **Lighthouse CI** uploads a report per run (temporary public storage by
  default — point `upload.target` at your own LHCI server or Github status
  check storage for a persistent, shareable trend view).

## Extending

- Add a new RUM metric: extend `MetricName` and `PERFORMANCE_BUDGETS` in
  `src/lib/performanceMonitoring.ts`, then emit it from
  `initPerformanceMonitoring()`.
- Add a new audited route: add its URL to `lighthouserc.json`'s
  `collect.url` array.
