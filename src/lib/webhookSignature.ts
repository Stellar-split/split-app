export async function computeWebhookSignature(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  // Use crypto from global context (works in Browser and Node.js 18+)
  const cryptoAPI = typeof window !== "undefined" ? window.crypto : (globalThis as any).crypto;
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

  const signatureBuffer = await cryptoAPI.subtle.sign("HMAC", key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
