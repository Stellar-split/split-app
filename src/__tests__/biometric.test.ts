import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BIOMETRIC_CREDENTIAL_KEY,
  enableBiometric,
  isBiometricAvailable,
  verifyBiometric,
} from "@/lib/biometric";
import { readSecurityEvents } from "@/lib/walletSecurity";

const credentialId = new Uint8Array([1, 2, 3, 4]).buffer;

function installWebAuthnMocks({ verified = true, matchingId = true } = {}) {
  const authenticatorData = new Uint8Array(37);
  authenticatorData[32] = verified ? 0x04 : 0x01;
  const credentials = {
    create: vi.fn().mockResolvedValue({ rawId: credentialId }),
    get: vi.fn().mockResolvedValue({
      type: "public-key",
      rawId: matchingId ? credentialId : new Uint8Array([9, 9, 9]).buffer,
      response: { authenticatorData: authenticatorData.buffer },
    }),
  };

  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: { isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true) },
  });
  Object.defineProperty(navigator, "credentials", { configurable: true, value: credentials });
  return credentials;
}

describe("biometric authentication", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is available only in secure contexts with a platform authenticator", async () => {
    installWebAuthnMocks();
    expect(await isBiometricAvailable()).toBe(true);

    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    expect(await isBiometricAvailable()).toBe(false);
  });

  it("enrolls a platform credential and records enrollment analytics", async () => {
    const credentials = installWebAuthnMocks();
    await enableBiometric();

    expect(credentials.create).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.objectContaining({
        authenticatorSelection: expect.objectContaining({
          authenticatorAttachment: "platform",
          userVerification: "required",
        }),
      }),
    }));
    expect(localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)).toBe("AQIDBA");
    expect(readSecurityEvents()[0].type).toBe("biometric_enrolled");
  });

  it("accepts only the enrolled credential with user verification", async () => {
    installWebAuthnMocks();
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, "AQIDBA");
    expect(await verifyBiometric()).toBe(true);
    expect(readSecurityEvents()[0].type).toBe("biometric_success");
  });

  it("rejects an assertion without user verification or with another credential", async () => {
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, "AQIDBA");
    installWebAuthnMocks({ verified: false });
    expect(await verifyBiometric()).toBe(false);
    expect(readSecurityEvents()[0].type).toBe("biometric_failed");

    localStorage.clear();
    readSecurityEvents();
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, "AQIDBA");
    installWebAuthnMocks({ matchingId: false });
    expect(await verifyBiometric()).toBe(false);
  });
});