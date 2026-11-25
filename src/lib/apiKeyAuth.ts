import { NextRequest, NextResponse } from "next/server";
import { checkWriteScope, extractBearerToken } from "@/lib/apiKeys";
import { verifySignedApiKey } from "@/lib/signedApiKeys";

/** Returns an error response if the request lacks write-scoped API key access. */
export function requireWriteScope(request: NextRequest): NextResponse | null {
  const token = extractBearerToken(request.headers.get("authorization"));
  const result = checkWriteScope(token, verifySignedApiKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return null;
}
