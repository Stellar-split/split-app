import { NextResponse } from "next/server";
import { verifyMfaCode } from "@/lib/securitySettings";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

export async function POST(request: Request) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const result = verifyMfaCode(String(body.userId || "default-user"), String(body.code || ""));

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to verify MFA code." }, { status: 500 });
  }
}
