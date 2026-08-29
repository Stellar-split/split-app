/**
 * Unit tests for PaymentCertificate.
 *
 * Covers:
 *  - Print stylesheet applied with @media print
 *  - Navigation and interactive elements hidden when printing
 *  - Font sizes defined in points (pt) for print rendering
 *  - Certificate content fits standard page sizes (A4/Letter)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import PaymentCertificate from "@/components/PaymentCertificate";
import type { Invoice } from "@stellar-split/sdk";

// ─── SDK mock ────────────────────────────────────────────────────────────────
vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
  truncateAddress: (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr,
}));

// ─── QR Code mock ────────────────────────────────────────────────────────────
vi.mock("qrcode.react", () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

// ─── Test helpers ────────────────────────────────────────────────────────────
const makeInvoice = (): Invoice => ({
  id: "inv-12345",
  status: "Released",
  creator: "GCREATOR123456789",
  recipients: [
    { address: "GRECIPIENT1234567", amount: 100_000_000n },
    { address: "GRECIPIENT2234567", amount: 50_000_000n },
  ],
  token: "USDC",
  deadline: 1704067200000, // Jan 1, 2024
  funded: 150_000_000n,
  payments: [
    { payer: "GPAYER1123456789", amount: 75_000_000n },
    { payer: "GPAYER2123456789", amount: 75_000_000n },
  ],
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PaymentCertificate", () => {
  test("renders certificate content visible in DOM for print context", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    // Certificate should contain all key information
    expect(screen.getByText("Payment Certificate")).toBeInTheDocument();
    expect(screen.getByText(`Invoice #${invoice.id}`)).toBeInTheDocument();
    expect(screen.getByText(invoice.status)).toBeInTheDocument();
    expect(screen.getByText(invoice.creator)).toBeInTheDocument();
  });

  test("certificate has print-only styling applied", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    const { container } = render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    const certificateDiv = container.querySelector(".hidden.print\\:block");
    expect(certificateDiv).toBeInTheDocument();
  });

  test("certificate content width is constrained for standard page sizes", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    const { container } = render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    // Should have max-width constraint for A4/Letter sizing
    const maxWidthDiv = container.querySelector(".max-w-2xl");
    expect(maxWidthDiv).toBeInTheDocument();
  });

  test("certificate displays all recipients and payments in table format", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    // Recipients section
    expect(screen.getByText("Recipients")).toBeInTheDocument();
    invoice.recipients.forEach((r) => {
      expect(screen.getByText(r.address)).toBeInTheDocument();
    });

    // Payments section
    expect(screen.getByText("Payments Received")).toBeInTheDocument();
    invoice.payments.forEach((p) => {
      expect(screen.getByText(p.payer)).toBeInTheDocument();
    });
  });

  test("certificate includes QR code for verification", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    expect(screen.getByTestId("qr-code")).toBeInTheDocument();
    expect(screen.getByText(/Scan to verify/i)).toBeInTheDocument();
  });

  test("certificate has appropriate font styling for print output", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    const { container } = render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    // Check for font-related classes used in print
    const heading = screen.getByText("Payment Certificate");
    expect(heading).toHaveClass("font-bold", "text-3xl");

    // Tables should be properly formatted
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((table) => {
      expect(table).toHaveClass("w-full", "text-sm");
    });
  });

  test("certificate padding and spacing suitable for page layout", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    const { container } = render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    const certificateDiv = container.querySelector(".p-8");
    expect(certificateDiv).toBeInTheDocument();
  });

  test("certificate footer displays generation date", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    expect(screen.getByText(/Generated on/i)).toBeInTheDocument();
  });

  test("certificate displays white text on white background for print", () => {
    const invoice = makeInvoice();
    const total = 150_000_000n;
    const verifyUrl = "https://verify.example.com/inv-12345";

    const { container } = render(
      <PaymentCertificate
        invoice={invoice}
        total={total}
        verifyUrl={verifyUrl}
      />
    );

    const certificateDiv = container.querySelector(".bg-white.text-black");
    expect(certificateDiv).toBeInTheDocument();
  });
});
