/**
 * Unit tests for BatchPayModal.
 *
 * Covers:
 *  - "Pay All" button disabled when wallet is disconnected
 *  - Tooltip shown when button is disabled
 *  - Button enabled when wallet is connected
 *  - Payment confirmation flows
 */

import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import BatchPayModal from "@/components/BatchPayModal";
import type { Invoice } from "@stellar-split/sdk";

// ─── Hoist mock references ────────────────────────────────────────────────────
const { mockPayWithNonce, mockGetPublicKey } = vi.hoisted(() => ({
  mockPayWithNonce: vi.fn(),
  mockGetPublicKey: vi.fn(),
}));

// ─── Stellar client mock ─────────────────────────────────────────────────────
vi.mock("@/lib/stellar", () => ({
  payWithNonce: (...args: unknown[]) => mockPayWithNonce(...args),
  splitClient: {},
}));

// ─── useWallet mock ──────────────────────────────────────────────────────────
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    publicKey: mockGetPublicKey(),
    isConnected: !!mockGetPublicKey(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// ─── SDK mock ────────────────────────────────────────────────────────────────
vi.mock("@stellar-split/sdk", () => ({
  parseAmount: (str: string) => BigInt(Math.floor(parseFloat(str) * 10_000_000)),
}));

// ─── Test helpers ────────────────────────────────────────────────────────────
const makeInvoice = (id: string): Invoice => ({
  id,
  status: "Pending",
  creator: "CREATOR",
  recipients: [{ address: "RECIP", amount: 100_000_000n }],
  token: "USDC",
  deadline: 0,
  funded: 0n,
  payments: [],
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("BatchPayModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockPayWithNonce.mockReset();
    mockGetPublicKey.mockReset();
    mockOnClose.mockReset();
  });

  test("Pay All button is disabled when wallet is not connected", () => {
    // No wallet connected
    mockGetPublicKey.mockReturnValue(null);

    const invoices = [makeInvoice("inv-1")];
    render(
      <BatchPayModal
        invoices={invoices}
        publicKey=""
        onClose={mockOnClose}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).toBeDisabled();
  });

  test("disabled Pay All button shows tooltip: 'Connect your wallet to continue'", () => {
    // No wallet connected
    mockGetPublicKey.mockReturnValue(null);

    const invoices = [makeInvoice("inv-1")];
    render(
      <BatchPayModal
        invoices={invoices}
        publicKey=""
        onClose={mockOnClose}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).toHaveAttribute(
      "title",
      "Connect your wallet to continue"
    );
  });

  test("Pay All button is enabled when wallet is connected", () => {
    // Wallet is connected
    mockGetPublicKey.mockReturnValue("GWALLETADDRESS123456789");

    const invoices = [makeInvoice("inv-1")];
    render(
      <BatchPayModal
        invoices={invoices}
        publicKey="GWALLETADDRESS123456789"
        onClose={mockOnClose}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).not.toBeDisabled();
  });

  test("enabled Pay All button does not show wallet connection tooltip", () => {
    // Wallet is connected
    mockGetPublicKey.mockReturnValue("GWALLETADDRESS123456789");

    const invoices = [makeInvoice("inv-1")];
    render(
      <BatchPayModal
        invoices={invoices}
        publicKey="GWALLETADDRESS123456789"
        onClose={mockOnClose}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).not.toHaveAttribute(
      "title",
      "Connect your wallet to continue"
    );
  });

  test("button becomes enabled after wallet connects", () => {
    // Initially no wallet
    mockGetPublicKey.mockReturnValue(null);

    const invoices = [makeInvoice("inv-1")];
    const { rerender } = render(
      <BatchPayModal
        invoices={invoices}
        publicKey=""
        onClose={mockOnClose}
      />
    );

    let confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).toBeDisabled();

    // Wallet connects
    mockGetPublicKey.mockReturnValue("GWALLETADDRESS123456789");

    rerender(
      <BatchPayModal
        invoices={invoices}
        publicKey="GWALLETADDRESS123456789"
        onClose={mockOnClose}
      />
    );

    confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    expect(confirmButton).not.toBeDisabled();
  });

  test("payment succeeds when wallet is connected and amounts provided", async () => {
    mockGetPublicKey.mockReturnValue("GWALLETADDRESS123456789");
    mockPayWithNonce.mockResolvedValue({ txHash: "tx123abc" });

    const invoices = [makeInvoice("inv-1")];
    render(
      <BatchPayModal
        invoices={invoices}
        publicKey="GWALLETADDRESS123456789"
        onClose={mockOnClose}
      />
    );

    // Enter amount
    const amountInput = screen.getByPlaceholderText(/USDC amount/i);
    fireEvent.change(amountInput, { target: { value: "10.5" } });

    // Click Confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm Payment/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // Verify payment was called
    expect(mockPayWithNonce).toHaveBeenCalled();

    // Verify success message shown
    await act(async () => {
      // Wait for success message
    });
    expect(screen.getByText(/Batch payment sent!/i)).toBeInTheDocument();
  });
});
