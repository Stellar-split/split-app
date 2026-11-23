import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/csp-report
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * The report body is a JSON object sent by the browser automatically
 * when a CSP directive is violated.
 *
 * Set CSP_REPORT_URI=https://your-app.vercel.app/api/csp-report in production.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const report = (body['csp-report'] ?? body) as Record<string, unknown>;

    // Log structured violation for monitoring / alerting.
    console.warn('[CSP Violation]', JSON.stringify({
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      blockedUri: report['blocked-uri'],
      originalPolicy: typeof report['original-policy'] === 'string'
        ? report['original-policy'].slice(0, 200) + '...'
        : undefined,
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      timestamp: new Date().toISOString(),
    }));

    return new NextResponse(null, { status: 204 });
  } catch {
    // Malformed report — ignore silently.
    return new NextResponse(null, { status: 204 });
  }
}
