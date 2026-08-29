import { NextResponse } from "next/server";
import { isValidCsrfToken } from "@/lib/csrf";

export const CSRF_HEADER = "x-csrf-token";

/**
 * Guard for mutating route handlers. Returns a 403 NextResponse when the
 * `X-CSRF-Token` header is missing or invalid, otherwise null so the caller
 * can proceed. Takes the plain `Request` type (which `NextRequest` extends)
 * so it works with route handlers that haven't opted into NextRequest.
 *
 * Usage:
 *   export async function POST(request: NextRequest) {
 *     const csrfError = await assertCsrf(request);
 *     if (csrfError) return csrfError;
 *     ...
 *   }
 */
export async function assertCsrf(request: Request): Promise<NextResponse | null> {
  const token = request.headers.get(CSRF_HEADER);
  if (!(await isValidCsrfToken(token))) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
  }
  return null;
}
