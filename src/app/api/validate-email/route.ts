import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { promises as dns } from "dns";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const parts = email.split("@");
    if (parts.length !== 2) {
      return NextResponse.json(
        { valid: false, hasMX: false },
        { status: 200 }
      );
    }

    const domain = parts[1];

    try {
      const mxRecords = await dns.resolveMx(domain);
      const hasMX = Array.isArray(mxRecords) && mxRecords.length > 0;
      return NextResponse.json({ valid: true, hasMX }, { status: 200 });
    } catch {
      return NextResponse.json({ valid: true, hasMX: false }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Validation failed: ${message}` },
      { status: 500 }
    );
  }
}
