import { NextRequest, NextResponse } from "next/server";
import { type ApiKeyScope } from "@/lib/apiKeys";
import { generateSignedApiKey } from "@/lib/signedApiKeys";

function isScope(value: unknown): value is ApiKeyScope {
  return value === "read" || value === "write";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const scope = body?.scope;

  if (!isScope(scope)) {
    return NextResponse.json({ error: "scope must be read or write" }, { status: 400 });
  }

  return NextResponse.json(generateSignedApiKey(scope));
}
