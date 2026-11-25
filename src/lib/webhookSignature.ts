export async function computeWebhookSignature(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  // Prefer window.crypto in browser, fall back to globalThis.crypto (Node 18+).
  // The `as any` cast handles older @types/node that don't expose webcrypto.
  const cryptoAPI: Crypto =
    typeof window !== "undefined"
      ? window.crypto
      : (globalThis as any).crypto;

  if (!cryptoAPI || !cryptoAPI.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  const key = await cryptoAPI.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await cryptoAPI.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
