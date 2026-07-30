import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

/** GET /api/csrf — issues a fresh CSRF token, valid for 60 minutes. */
export async function GET() {
  const { token, expiresAt } = await generateCsrfToken();
  return NextResponse.json({ token, expiresAt });
}
