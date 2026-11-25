/**
 * Client-side access code hashing and verification utilities.
 */

/**
 * Hashes an access code using SHA-256.
 */
export async function hashAccessCode(code: string): Promise<string> {
  const trimmed = code.trim();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(trimmed);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for Node.js / test environments
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(trimmed).digest("hex");
  } catch {
    throw new Error("Crypto API unavailable");
  }
}

/**
 * Verifies an access code against a stored SHA-256 hash.
 */
export async function verifyAccessCode(code: string, storedHash?: string): Promise<boolean> {
  if (!code || !storedHash) return false;
  const computed = await hashAccessCode(code);
  return computed.toLowerCase() === storedHash.trim().toLowerCase();
}
