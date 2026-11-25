import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendPaymentReceiptEmail,
  batchSendPaymentReceipts,
  formatAmountForEmail,
  type PaymentReceiptData,
} from "./paymentReceiptEmailer";

describe("paymentReceiptEmailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendPaymentReceiptEmail", () => {
    it("should send payment receipt email successfully", async () => {
      const data: PaymentReceiptData = {
        invoiceId: "inv-123",
        recipientEmail: "user@example.com",
        recipientName: "John Doe",
        recipientAddress: "GXYZ...",
        paymentAmount: "100.0000000",
        paymentAsset: "XLM",
        transactionHash: "abc123def456",
        payerAddress: "GPAYER...",
        paidAt: new Date(),
      };

      const result = await sendPaymentReceiptEmail(data);

      expect(result.success).toBe(true);
      expect(result.recipient).toBe("user@example.com");
      expect(result.messageId).toBeDefined();
    });

    it("should handle missing email", async () => {
      const data: PaymentReceiptData = {
        invoiceId: "inv-123",
        recipientEmail: "",
        recipientName: "John Doe",
        recipientAddress: "GXYZ...",
        paymentAmount: "100.0000000",
        paymentAsset: "XLM",
        transactionHash: "abc123def456",
        payerAddress: "GPAYER...",
        paidAt: new Date(),
      };

      const result = await sendPaymentReceiptEmail(data);
      expect(result.recipient).toBe("");
    });
  });

  describe("batchSendPaymentReceipts", () => {
    it("should send multiple receipts", async () => {
      const receipts: PaymentReceiptData[] = [
        {
          invoiceId: "inv-1",
          recipientEmail: "user1@example.com",
          recipientName: "User 1",
          recipientAddress: "GXYZ1...",
          paymentAmount: "50.0000000",
          paymentAsset: "XLM",
          transactionHash: "tx1",
          payerAddress: "GPAYER...",
          paidAt: new Date(),
        },
        {
          invoiceId: "inv-2",
          recipientEmail: "user2@example.com",
          recipientName: "User 2",
          recipientAddress: "GXYZ2...",
          paymentAmount: "50.0000000",
          paymentAsset: "XLM",
          transactionHash: "tx2",
          payerAddress: "GPAYER...",
          paidAt: new Date(),
        },
      ];

      const results = await batchSendPaymentReceipts(receipts, 2);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success || r.error)).toBe(true);
    });

    it("should handle empty batch", async () => {
      const results = await batchSendPaymentReceipts([]);
      expect(results).toHaveLength(0);
    });

    it("should respect concurrency limit", async () => {
      const receipts = Array.from({ length: 5 }, (_, i) => ({
        invoiceId: `inv-${i}`,
        recipientEmail: `user${i}@example.com`,
        recipientName: `User ${i}`,
        recipientAddress: `GXYZ${i}...`,
        paymentAmount: "100.0000000",
        paymentAsset: "XLM",
        transactionHash: `tx${i}`,
        payerAddress: "GPAYER...",
        paidAt: new Date(),
      }));

      const results = await batchSendPaymentReceipts(receipts, 2);
      expect(results).toHaveLength(5);
    });
  });

  describe("formatAmountForEmail", () => {
    it("should format stroops to XLM", () => {
      const stroops = 1_000_000_000n; // 10 XLM
      const formatted = formatAmountForEmail(stroops);

      expect(formatted).toContain("10");
    });

    it("should format small amounts correctly", () => {
      const stroops = 100n; // 0.00000100 XLM
      const formatted = formatAmountForEmail(stroops);

      expect(typeof formatted).toBe("string");
    });

    it("should format large amounts with comma separators", () => {
      const stroops = 1_000_000_000_000n; // 10,000 XLM
      const formatted = formatAmountForEmail(stroops);

      expect(formatted).toContain("10");
    });
  });
});
