export function getEmbedAnalyticsSigningSecret(): string {
  const secret = process.env.EMBED_ANALYTICS_SIGNING_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMBED_ANALYTICS_SIGNING_SECRET must be configured in production.");
  }
  return process.env.API_KEY_SIGNING_SECRET ?? "split-app-dev-embed-signing-secret";
}