# Content Security Policy Headers

## Overview
StellarSplit implements a per-request nonce-based CSP to prevent XSS attacks.
A fresh nonce is generated on every request by `src/middleware.ts` and embedded
into `script-src` and `style-src` directives.

## Policy Breakdown

| Directive | Value | Reason |
|-----------|-------|--------|
| `default-src` | `'self'` | Restrict everything to same origin by default |
| `script-src` | `'self' 'nonce-{n}' 'strict-dynamic'` | Nonce for inline scripts, strict-dynamic propagates trust to loaded scripts |
| `style-src` | `'self' 'nonce-{n}' 'unsafe-inline'` | Nonce for inline styles; unsafe-inline needed for Tailwind's CSS-in-JS |
| `img-src` | `'self' data: blob: https://www.gravatar.com` | Allow Gravatar avatars and data URIs |
| `connect-src` | `'self' https://*.stellar.org ...` | Stellar network endpoints + optional analytics |
| `object-src` | `'none'` | Block plugins (Flash, Java) entirely |
| `base-uri` | `'self'` | Prevent base tag hijacking |
| `form-action` | `'self'` | Prevent form submission to external sites |
| `frame-ancestors` | `'none'` (or `*` for /embed routes) | Prevent clickjacking |
| `upgrade-insecure-requests` | — | Rewrite HTTP subresource requests to HTTPS |
| `report-uri` | (optional) | Receive violation reports from browsers |

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `CSP_REPORT_URI` | URL to receive violation reports (e.g. `https://your-app.vercel.app/api/csp-report`) |
| `ANALYTICS_ENABLED` | Set to `true` to add `ANALYTICS_ENDPOINT_ORIGINS` to `connect-src` |
| `ANALYTICS_ENDPOINT_ORIGINS` | Comma-separated analytics origins |
| `BACKUP_ALERTS_ENABLED` | Set to `true` to add `BACKUP_WEBHOOK_ORIGINS` to `connect-src` |
| `BACKUP_WEBHOOK_ORIGINS` | Comma-separated backup webhook origins |

## Nonce Flow
1. Middleware generates `nonce = base64(randomUUID())`
2. Nonce is set as `x-nonce` request header for Server Components
3. CSP header is set on the response with the nonce embedded
4. `src/lib/csp.ts:getNonce()` reads it in Server Components via `next/headers`
5. `src/app/layout.tsx` passes the nonce to inline `<script>` and `<style>` tags

## Violation Reporting
Set `CSP_REPORT_URI` to `https://your-app.vercel.app/api/csp-report` to log violations server-side.
The report route at `src/app/api/csp-report/route.ts` logs violations as structured JSON.
