import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Payment } from "@stellar-split/sdk";
import PaymentExport from "@/components/PaymentExport";
import {
  buildPaymentSummaryHtml,
  generatePaymentSummaryFilename,
} from "@/lib/paymentExportPdf";
import { darkTheme, lightTheme } from "@/lib/pdfTheme";

const INVOICE_ID = "INV-1";

type PaymentWithMeta = Payment & { timestamp?: number; txHash?: string };

const payments = [
  {
    payer: "GPAYERADDRESS000000000000000000000000000000000000000000",
    amount: 25_000_000n,
    timestamp: 1_700_000_000,
    txHash: "abcdef1234567890",
  },
] as unknown as PaymentWithMeta[];

describe("buildPaymentSummaryHtml", () => {
  it("includes the invoice number, addresses, amounts and transaction hashes", () => {
    const html = buildPaymentSummaryHtml(INVOICE_ID, payments);

    expect(html).toContain(`Invoice #${INVOICE_ID}`);
    expect(html).toContain("GPAYERADDRESS000000000000000000000000000000000000000000");
    expect(html).toContain("abcdef1234567890");
    expect(html).toContain("USDC");
  });

  it("uses colour tokens from pdfTheme", () => {
    expect(buildPaymentSummaryHtml(INVOICE_ID, payments)).toContain(
      lightTheme.accent
    );
    expect(buildPaymentSummaryHtml(INVOICE_ID, payments, true)).toContain(
      darkTheme.accent
    );
  });

  it("renders an empty state when there are no payments", () => {
    expect(buildPaymentSummaryHtml(INVOICE_ID, [])).toContain(
      "No payments to export."
    );
  });

  it("escapes untrusted values instead of injecting them", () => {
    const html = buildPaymentSummaryHtml(INVOICE_ID, [
      { payer: "<script>alert(1)</script>", amount: 1n },
    ] as unknown as PaymentWithMeta[]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("generatePaymentSummaryFilename", () => {
  it("produces a dated .pdf filename for the invoice", () => {
    expect(generatePaymentSummaryFilename(INVOICE_ID)).toMatch(
      /^payments-invoice-INV-1-\d{4}-\d{2}-\d{2}\.pdf$/
    );
  });
});

describe("PaymentExport PDF option", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a PDF option in the export format selector", () => {
    render(
      <PaymentExport invoiceId={INVOICE_ID} payments={payments as Payment[]} />
    );
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
  });

  it("opens the printable payment summary when PDF export is triggered", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(
      <PaymentExport invoiceId={INVOICE_ID} payments={payments as Payment[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    fireEvent.click(
      screen.getByRole("button", { name: /export payments pdf/i })
    );

    expect(openSpy).toHaveBeenCalled();
  });
});
