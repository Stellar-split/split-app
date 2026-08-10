import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { consumeMfaToken } from "@/lib/securitySettings";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";


export async function POST(request: Request) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const result = consumeMfaToken(String(body.token || ""));

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to consume the MFA token." }, { status: 500 });
  }
}
