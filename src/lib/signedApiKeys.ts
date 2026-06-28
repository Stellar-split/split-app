import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { type ApiKeyScope } from "@/lib/apiKeys";

const KEY_PATTERN = /^sk_(read|write)_([A-Za-z0-9_-]{16,})\.([A-Za-z0-9_-]{43})$/;

function signingSecret(): string {
  return process.env.API_KEY_SIGNING_SECRET ?? "split-app-dev-api-key-signing-secret";
}

function sign(scope: ApiKeyScope, id: string): string {
  return createHmac("sha256", signingSecret())
    .update(`${scope}.${id}`)
    .digest("base64url");
}

export function generateSignedApiKey(scope: ApiKeyScope): { id: string; key: string } {
  const id = randomBytes(18).toString("base64url");
  return { id, key: `sk_${scope}_${id}.${sign(scope, id)}` };
}

export function verifySignedApiKey(token: string): ApiKeyScope | null {
  const match = KEY_PATTERN.exec(token);
  if (!match) return null;

  const scope = match[1] as ApiKeyScope;
  const id = match[2];
  const signature = match[3];
  const expected = sign(scope, id);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;

  return timingSafeEqual(actualBuffer, expectedBuffer) ? scope : null;
}
