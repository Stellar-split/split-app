import { describe, expect, it } from "vitest";
import { createEmbedAnalyticsToken, verifyEmbedAnalyticsToken } from "./embedAnalyticsToken";

const secret = "test-embed-token-secret";
const creator = `G${"A".repeat(55)}`;

describe("embed analytics tokens", () => {
  it("verifies creator-scoped claims until expiration", () => {
    const { token, claims } = createEmbedAnalyticsToken(
      { creator, origin: "https://client.example", tokenId: "token-1" },
      secret,
      1000,
    );

    expect(verifyEmbedAnalyticsToken(token, secret, 2000)).toEqual(claims);
    expect(verifyEmbedAnalyticsToken(token, secret, claims.expiresAt)).toBeNull();
  });

  it("rejects tampering, invalid signatures, and malformed credentials", () => {
    const { token } = createEmbedAnalyticsToken({ creator, tokenId: "token-2" }, secret, 1000);
    const [payload, signature] = token.split(".");
    const changedPayload = `${Buffer.from(JSON.stringify({ creator: `G${"B".repeat(55)}`, scope: "analytics:read", expiresAt: 9999999999999, tokenId: "token-2", issuedAt: 1000, origin: null })).toString("base64url")}.${signature}`;

    expect(verifyEmbedAnalyticsToken(changedPayload, secret, 2000)).toBeNull();
    expect(verifyEmbedAnalyticsToken(token, "wrong-secret", 2000)).toBeNull();
    expect(verifyEmbedAnalyticsToken(`${payload}.bad`, secret, 2000)).toBeNull();
  });
});