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
}

export function buildCSP(nonce: string, { allowFraming = false }: BuildCSPOptions = {}): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://www.gravatar.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.stellar.org https://horizon-testnet.stellar.org https://horizon.stellar.org https://soroban-testnet.stellar.org`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    allowFraming ? `frame-ancestors *` : `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join("; ");
}

/** Reads the per-request nonce set by middleware. Server Components only. */
export function getNonce(): string | undefined {
  return headers().get(CSP_NONCE_HEADER) ?? undefined;
}
