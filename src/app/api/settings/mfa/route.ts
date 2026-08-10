import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa, getSecuritySettings, saveHighValueThreshold } from "@/lib/securitySettings";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default-user";
  const settings = getSecuritySettings(userId);

  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const userId = String(body.userId || "default-user");
    const action = String(body.action || "save-settings");

    if (action === "enroll") {
      const enrollment = await beginMfaEnrollment(userId);
      return NextResponse.json(enrollment);
    }

    if (action === "confirm") {
      const result = confirmMfaEnrollment(userId, String(body.code || ""));
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === "disable") {
      const result = disableMfa(userId, String(body.code || ""));
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const threshold = Number(body.highValueThreshold ?? 1000);
    const settings = saveHighValueThreshold(userId, threshold);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update MFA settings." }, { status: 500 });
  }
}
