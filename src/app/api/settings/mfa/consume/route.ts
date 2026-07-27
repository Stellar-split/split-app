import { NextResponse } from "next/server";
import { consumeMfaToken } from "@/lib/securitySettings";

export async function POST(request: Request) {
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
