import { computeWebhookSignature } from "./webhookSignature";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import crypto from "crypto";

// jsdom does not implement crypto.subtle, so install Node's Web Crypto
// implementation (which provides subtle.importKey/sign) on the global object.
const nodeWebCrypto = crypto.webcrypto as unknown as Crypto;

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: nodeWebCrypto,
    configurable: true,
    writable: true,
  });
}

describe("Webhook Signature", () => {
  beforeEach(() => {
    // Ensure subtle.importKey is available for every test.
    if (!globalThis.crypto?.subtle?.importKey) {
      Object.defineProperty(globalThis, "crypto", {
        value: nodeWebCrypto,
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes crypto.subtle.importKey", () => {
    expect(typeof globalThis.crypto.subtle.importKey).toBe("function");
  });

  it("matches a known HMAC test vector", async () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ event: "invoice.paid", id: "123" });

    const computedSignature = await computeWebhookSignature(secret, payload);

    // Compute expected signature using Node's crypto module
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(computedSignature).toEqual(expectedSignature);
  });

  it("matches the RFC 4231 HMAC-SHA256 test vector", async () => {
    const secret = "Jefe";
    const payload = "what do ya want for nothing?";

    const computedSignature = await computeWebhookSignature(secret, payload);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(computedSignature).toEqual(expectedSignature);
    expect(computedSignature).toEqual(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
    );
  });
});
