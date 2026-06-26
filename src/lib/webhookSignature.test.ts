import { computeWebhookSignature } from "./webhookSignature";
import crypto from "crypto";

// Polyfill Web Crypto for the Jest environment if it's missing.
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = crypto.webcrypto;
}

describe("Webhook Signature", () => {
  it("matches a known HMAC test vector", async () => {
    const secret = "test-secret";
    const payload = JSON.stringify({ event: "invoice.paid", id: "123" });
    
    // Compute using the function we are testing
    const computedSignature = await computeWebhookSignature(secret, payload);

    // Compute expected signature using Node's crypto module
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(computedSignature).toEqual(expectedSignature);
  });
});
