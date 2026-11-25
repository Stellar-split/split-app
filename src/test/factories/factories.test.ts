import { describe, it, expect, beforeEach } from "vitest";
import {
  buildInvoice,
  buildInvoiceList,
  invoiceFixtures,
  buildPayment,
  buildPaymentList,
  paymentFixtures,
  buildUser,
  buildUserList,
  userFixtures,
  resetAllFactorySequences,
} from "./index";

describe("test data factories", () => {
  beforeEach(() => {
    resetAllFactorySequences();
  });

  describe("invoiceFactory", () => {
    it("builds a valid invoice with defaults", () => {
      const invoice = buildInvoice();
      expect(invoice.id).toBe("invoice-1");
      expect(invoice.status).toBe("Pending");
      expect(invoice.recipients).toHaveLength(1);
      expect(invoice.tokenAddress).toHaveLength(56);
    });

    it("applies overrides without losing defaults", () => {
      const invoice = buildInvoice({ status: "Funded", amount: "999" });
      expect(invoice.status).toBe("Funded");
      expect(invoice.amount).toBe("999");
      expect(invoice.recipients).toHaveLength(1);
    });

    it("builds a list of unique invoices", () => {
      const invoices = buildInvoiceList(3);
      const ids = invoices.map((i) => i.id);
      expect(new Set(ids).size).toBe(3);
    });

    it("exposes lifecycle fixtures", () => {
      expect(invoiceFixtures.fullyFunded().status).toBe("Funded");
      expect(invoiceFixtures.disputed().status).toBe("Disputed");
      expect(invoiceFixtures.withMultipleRecipients().recipients).toHaveLength(2);
    });
  });

  describe("paymentFactory", () => {
    it("builds a valid payment with defaults", () => {
      const payment = buildPayment();
      expect(payment.status).toBe("pending");
      expect(payment.completedAt).toBeNull();
      expect(payment.txHash).toHaveLength(64);
    });

    it("builds a list of unique payments", () => {
      const payments = buildPaymentList(3);
      const ids = new Set(payments.map((p) => p.id));
      expect(ids.size).toBe(3);
    });

    it("exposes lifecycle fixtures", () => {
      expect(paymentFixtures.completed().completedAt).not.toBeNull();
      expect(paymentFixtures.failed().status).toBe("failed");
    });
  });

  describe("userFactory", () => {
    it("builds a valid user with defaults", () => {
      const user = buildUser();
      expect(user.isVerified).toBe(false);
      expect(user.walletAddress).toHaveLength(56);
    });

    it("builds a list of unique users", () => {
      const users = buildUserList(3);
      expect(new Set(users.map((u) => u.id)).size).toBe(3);
    });

    it("exposes fixtures", () => {
      expect(userFixtures.verified().isVerified).toBe(true);
      expect(userFixtures.anonymous().email).toBeNull();
    });
  });

  describe("resetAllFactorySequences", () => {
    it("resets ids back to the first sequence value", () => {
      buildInvoice();
      buildInvoice();
      resetAllFactorySequences();
      expect(buildInvoice().id).toBe("invoice-1");
    });
  });
});
