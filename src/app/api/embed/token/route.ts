import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { extractBearerToken } from "@/lib/apiKeys";
import { verifySignedApiKey } from "@/lib/signedApiKeys";
import { createEmbedAnalyticsToken } from "@/lib/embedAnalyticsToken";
import { getEmbedAnalyticsSigningSecret } from "@/lib/embedAnalyticsSecret";

export const dynamic = "force-dynamic";

function normalizeOrigin(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  try {
    const origin = new URL(value).origin;
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return undefined;
    return origin;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = extractBearerToken(request.headers.get("authorization"));
  const scope = apiKey ? verifySignedApiKey(apiKey) : null;
  if (!scope) {
    return NextResponse.json({ error: "A valid API key is required." }, { status: 401 });
  }
  if (scope !== "read") return NextResponse.json({ error: "Embed analytics requires a read-only API key." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const creator = body?.creator;
  const origin = normalizeOrigin(body?.origin);
  if (typeof creator !== "string" || !/^G[A-Z2-7]{55}$/.test(creator)) {
    return NextResponse.json({ error: "A valid Stellar creator address is required." }, { status: 400 });
  }
  if (!origin) {
    return NextResponse.json({ error: "A trusted HTTPS client origin is required (localhost is allowed for development)." }, { status: 400 });
  }

  const { token, claims } = createEmbedAnalyticsToken(
    { creator, origin, tokenId: randomUUID() },
    getEmbedAnalyticsSigningSecret(),
  );
  return NextResponse.json({ token, expiresAt: claims.expiresAt });
}