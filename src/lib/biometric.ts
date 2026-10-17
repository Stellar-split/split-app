/**
 * Optional biometric unlock using the device's platform authenticator
 * (Touch ID, Face ID, Windows Hello, Android fingerprint) via WebAuthn.
 *
 * This is a local presence check used to unlock an idle session — it proves
 * the person at the device can pass the OS biometric prompt. It does not
 * replace wallet signatures and nothing is sent to a server.
 */

export const BIOMETRIC_CREDENTIAL_KEY = "stellarsplit_biometric_credential";

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

function randomBytes(n: number): ArrayBuffer {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes.buffer as ArrayBuffer;
}

/** True when this browser/device offers a user-verifying platform authenticator. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getBiometricCredentialId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  } catch {
    return null;
  }
}

export function isBiometricEnabled(): boolean {
  return getBiometricCredentialId() !== null;
}

/** Register a platform credential and remember its ID. Prompts the OS biometric dialog. */
export async function enableBiometric(label = "StellarSplit"): Promise<void> {
  if (!(await isBiometricAvailable())) {
    throw new Error("Biometric authentication isn't available on this device.");
  }
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "StellarSplit", id: window.location.hostname },
      user: { id: randomBytes(16), name: label, displayName: label },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Biometric setup was cancelled.");
  window.localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, toBase64Url(credential.rawId));
}

export function disableBiometric(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}

/** Ask the OS to verify the user with the registered credential. Resolves true on success. */
export async function verifyBiometric(): Promise<boolean> {
  const id = getBiometricCredentialId();
  if (!id || !navigator.credentials) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: fromBase64Url(id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
