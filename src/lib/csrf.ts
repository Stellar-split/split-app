/**
 * CSRF token generation/validation for mutating API routes.
 *
 * Tokens are `${nonce}.${expiresAt}.${signatureHex}` — a random nonce and an
 * expiry, HMAC-signed with CSRF_SECRET so a client can't forge or extend
 * one. Verified with the Web Crypto API so this module runs unchanged in
 * both the Node and Edge runtimes.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

// Fail fast: a missing secret means every token would be forgeable, so this
// throws as soon as this module is loaded rather than degrading to an
// insecure default.
const CSRF_SECRET = (() => {
  const secret = process.env.CSRF_SECRET;
  if (!secret) {
    throw new Error("CSRF_SECRET environment variable is required but not set");
  }
  return secret;
})();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CSRF_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export interface CsrfToken {
  token: string;
  expiresAt: number;
}

export async function generateCsrfToken(): Promise<CsrfToken> {
  const nonce = crypto.randomUUID();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${nonce}.${expiresAt}`;
  const signature = await hmac(payload);
  return { token: `${payload}.${signature}`, expiresAt };
}

export async function isValidCsrfToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiresAtRaw, signature] = parts;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = await hmac(`${nonce}.${expiresAtRaw}`);
  return timingSafeEqual(signature, expectedSignature);
}
