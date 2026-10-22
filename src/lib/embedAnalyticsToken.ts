import { createHmac, timingSafeEqual } from "crypto";

export interface EmbedAnalyticsClaims {
  creator: string;
  origin: string | null;
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
  scope: "analytics:read";
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createEmbedAnalyticsToken(
  input: { creator: string; origin?: string | null; tokenId: string },
  secret: string,
  now = Date.now(),
): { token: string; claims: EmbedAnalyticsClaims } {
  const claims: EmbedAnalyticsClaims = {
    creator: input.creator,
    origin: input.origin ?? null,
    issuedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    tokenId: input.tokenId,
    scope: "analytics:read",
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${payload}.${signature(payload, secret)}`, claims };
}

export function verifyEmbedAnalyticsToken(
  token: string,
  secret: string,
  now = Date.now(),
): EmbedAnalyticsClaims | null {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra !== undefined) return null;
  const expected = signature(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EmbedAnalyticsClaims;
    if (
      claims.scope !== "analytics:read" ||
      !/^G[A-Z2-7]{55}$/.test(claims.creator) ||
      !Number.isFinite(claims.expiresAt) ||
      claims.expiresAt <= now ||
      !claims.tokenId
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}