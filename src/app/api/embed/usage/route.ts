import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken } from "@/lib/apiKeys";
import { verifySignedApiKey } from "@/lib/signedApiKeys";
import { getEmbedUsage } from "@/app/api/embed/usageStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = extractBearerToken(request.headers.get("authorization"));
  const scope = apiKey ? verifySignedApiKey(apiKey) : null;
  if (!scope) {
    return NextResponse.json({ error: "A valid API key is required." }, { status: 401 });
  }
  if (scope !== "read") return NextResponse.json({ error: "Embed usage requires a read-only API key." }, { status: 403 });
  const creator = request.nextUrl.searchParams.get("creator") ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(creator)) {
    return NextResponse.json({ error: "A valid Stellar creator address is required." }, { status: 400 });
  }
  const events = getEmbedUsage(creator);
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return NextResponse.json({
    total: events.length,
    last24Hours: events.filter((event) => event.timestamp >= oneDayAgo).length,
    lastUsedAt: events.length ? Math.max(...events.map((event) => event.timestamp)) : null,
  }, { headers: { "Cache-Control": "no-store" } });
}