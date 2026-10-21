/**
 * Content-Security-Policy — built per-request in middleware so `script-src`
 * and `style-src` can carry a fresh nonce every time (defeats injected
 * <script> tags that don't know the nonce, without resorting to 'unsafe-inline').
 */
import { headers } from "next/headers";

export const CSP_NONCE_HEADER = "x-nonce";

export interface BuildCSPOptions {
  /**
   * The embed route (`/embed/:id`) is designed to be framed by third-party
   * sites — it sets X-Frame-Options: ALLOWALL in next.config.js — so its CSP
   * must not send frame-ancestors 'none', which would override that in
   * browsers that honour CSP over the legacy header.
   */
  allowFraming?: boolean;
  /**
   * Additional origins to include in the `connect-src` directive. These are
   * merged with (and deduplicated against) the hardcoded Stellar origins.
   * Passed from middleware when analytics or backup webhook origins are
   * enabled via environment variables.
   */
  connectSrc?: string[];
  /**
   * URL to which the browser should POST CSP violation reports.
   * When set, a `report-uri` directive is appended to the policy.
   * Configure via the `CSP_REPORT_URI` environment variable.
   */
  reportUri?: string;
}

export function buildCSP(
  nonce: string,
  { allowFraming = false, connectSrc, reportUri }: BuildCSPOptions = {},
): string {
  const connectSrcOrigins = [
    "'self'",
    'https://*.stellar.org',
    'https://horizon-testnet.stellar.org',
    'https://horizon.stellar.org',
    'https://soroban-testnet.stellar.org',
    ...(connectSrc ?? []),
  ];
  // Deduplicate while preserving insertion order
  const uniqueConnectSrc = [...new Set(connectSrcOrigins)];

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://www.gravatar.com`,
    `font-src 'self' data:`,
    `connect-src ${uniqueConnectSrc.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    allowFraming ? `frame-ancestors *` : `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

/** Reads the per-request nonce set by middleware. Server Components only. */
export function getNonce(): string | undefined {
  return headers().get(CSP_NONCE_HEADER) ?? undefined;
}
