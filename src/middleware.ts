import { NextRequest, NextResponse } from "next/server";
import { buildCSP, CSP_NONCE_HEADER } from "@/lib/csp";

/**
 * Reads analytics/backup configuration from environment so that no
 * third-party domains are hardcoded into the CSP. When analytics is
 * disabled (the default), the policy stays strict and no extra origins
 * are allowed.
 */
function getAnalyticsOrigins(): string[] {
  if (process.env.ANALYTICS_ENABLED !== "true") {
    return [];
  }
  return (process.env.ANALYTICS_ENDPOINT_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getBackupWebhookOrigins(): string[] {
  if (process.env.BACKUP_ALERTS_ENABLED !== "true") {
    return [];
  }
  return (process.env.BACKUP_WEBHOOK_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCspReportUri(): string | undefined {
  return process.env.CSP_REPORT_URI || undefined;
}

/**
 * Generates a fresh CSP nonce per request and forwards it two ways:
 *  - as a request header, so Server Components can read it via next/headers
 *    and stamp it onto any inline <script>/<style> tags they render
 *  - as the Content-Security-Policy response header itself
 *
 * See https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isEmbed = request.nextUrl.pathname.startsWith("/embed/");
  const isAnalyticsEmbed = request.nextUrl.pathname.startsWith("/embed/analytics/");
  const requestedFrameOrigin = request.nextUrl.searchParams.get("origin");
  let frameOrigin: string | null | undefined;
  if (isAnalyticsEmbed) {
    try {
      const parsedOrigin = new URL(requestedFrameOrigin ?? "");
      frameOrigin = parsedOrigin.origin === requestedFrameOrigin &&
        (parsedOrigin.protocol === "https:" || parsedOrigin.hostname === "localhost")
        ? parsedOrigin.origin
        : null;
    } catch {
      frameOrigin = null;
    }
  }

  const connectSrc = [
    ...getAnalyticsOrigins(),
    ...getBackupWebhookOrigins(),
  ];

  const csp = buildCSP(nonce, {
    allowFraming: isEmbed,
    frameOrigin,
    connectSrc: connectSrc.length > 0 ? connectSrc : undefined,
    reportUri: getCspReportUri(),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("x-app-pathname", request.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets and image optimization files — they carry no
     * inline scripts and re-running CSP generation for every asset request
     * is pure overhead.
     *
     * Also skip the interactive API documentation route (/api-docs) and the
     * static OpenAPI spec (/openapi.json, /openapi.yaml). Swagger UI ships its
     * own bundled scripts/styles and the spec is a static JSON/YAML document,
     * so neither needs a per-request CSP nonce. Excluding them lets the
     * Swagger UI assets load correctly while CSP protections remain in place
     * for the rest of the app.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|api-docs|openapi\\.(?:json|yaml|yml)).*)",
  ],
};