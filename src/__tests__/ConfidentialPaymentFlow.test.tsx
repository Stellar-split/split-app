import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConfidentialPaymentFlow from "@/components/ConfidentialPaymentFlow";

const mockInvoiceId = "inv-42";
const mockPublicKey = "GABCDEF1234567890";

vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (value: bigint) => (Number(value) / 10_000_000).toFixed(2),
  parseAmount: (value: string) =>
    BigInt(Math.round(Number(value) * 10_000_000)),
}));

const mockGenerateBlindingFactor = vi.fn();
const mockCreatePedersenCommitment = vi.fn();
const mockSaveBlindingFactor = vi.fn();
const mockLoadBlindingFactor = vi.fn();
const mockHasBlindingFactor = vi.fn();
const mockSaveCommittedAmount = vi.fn();
const mockLoadCommittedAmount = vi.fn();
const mockMarkRevealed = vi.fn();
const mockIsRevealed = vi.fn();
const mockSubmitCommitment = vi.fn();
const mockRevealPayment = vi.fn();

vi.mock("@/lib/confidential", () => ({
  generateBlindingFactor: (...args: any[]) =>
    mockGenerateBlindingFactor(...args),
  createPedersenCommitment: (...args: any[]) =>
    mockCreatePedersenCommitment(...args),
  saveBlindingFactor: (...args: any[]) => mockSaveBlindingFactor(...args),
  loadBlindingFactor: (...args: any[]) => mockLoadBlindingFactor(...args),
  hasBlindingFactor: (...args: any[]) => mockHasBlindingFactor(...args),
  saveCommittedAmount: (...args: any[]) => mockSaveCommittedAmount(...args),
  loadCommittedAmount: (...args: any[]) => mockLoadCommittedAmount(...args),
  markRevealed: (...args: any[]) => mockMarkRevealed(...args),
  isRevealed: (...args: any[]) => mockIsRevealed(...args),
  submitCommitment: (...args: any[]) => mockSubmitCommitment(...args),
  revealPayment: (...args: any[]) => mockRevealPayment(...args),
}));

describe("ConfidentialPaymentFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRevealed.mockReturnValue(false);
    mockHasBlindingFactor.mockReturnValue(false);
    mockLoadCommittedAmount.mockReturnValue(null);
  });

  describe("initial state", () => {
    it("shows the commitment form when no blinding factor exists", async () => {
      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      expect(
        await screen.findByLabelText(/amount \(usdc\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /commit payment/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /reveal payment/i })
      ).not.toBeInTheDocument();
    });

    it("shows the reveal step when a blinding factor exists", async () => {
      mockHasBlindingFactor.mockReturnValue(true);
      mockLoadCommittedAmount.mockReturnValue("10.5");

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      expect(
        await screen.findByRole("button", { name: /reveal payment/i })
      ).toBeInTheDocument();
      const input = screen.getByLabelText(/amount \(usdc\)/i) as HTMLInputElement;
      expect(input.value).toBe("10.5");
      expect(input).toBeDisabled();
    });

    it("shows revealed state when payment was already revealed", async () => {
      mockIsRevealed.mockReturnValue(true);

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      expect(
        await screen.findByText(/payment revealed successfully/i)
      ).toBeInTheDocument();
    });

    it("shows missing blinding factor warning when reveal attempted without stored factor", async () => {
      mockHasBlindingFactor.mockReturnValue(true);
      mockLoadBlindingFactor.mockReturnValue(null);

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const revealButton = await screen.findByRole("button", {
        name: /reveal payment/i,
      });
      fireEvent.click(revealButton);
      expect(
        await screen.findByText(/recovery secret not found/i)
      ).toBeInTheDocument();
    });
  });

  describe("commitment flow", () => {
    it("commits successfully and transitions to committed state", async () => {
      mockGenerateBlindingFactor.mockReturnValue("abc123");
      mockCreatePedersenCommitment.mockResolvedValue("commitment_hash");
      mockSubmitCommitment.mockResolvedValue({ txHash: "tx_hash_123" });

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const input = await screen.findByLabelText(/amount \(usdc\)/i);
      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.click(screen.getByRole("button", { name: /commit payment/i }));

      expect(
        await screen.findByText(/commitment submitted successfully/i)
      ).toBeInTheDocument();
      expect(mockGenerateBlindingFactor).toHaveBeenCalledTimes(1);
      expect(mockCreatePedersenCommitment).toHaveBeenCalledWith(
        500_000_000n,
        "abc123"
      );
      expect(mockSubmitCommitment).toHaveBeenCalledWith({
        payer: mockPublicKey,
        invoiceId: mockInvoiceId,
        commitment: "commitment_hash",
      });
      expect(mockSaveBlindingFactor).toHaveBeenCalledWith(
        mockInvoiceId,
        mockPublicKey,
        "abc123"
      );
      expect(mockSaveCommittedAmount).toHaveBeenCalledWith(
        mockInvoiceId,
        mockPublicKey,
        "50"
      );
    });

    it("shows loading state while committing", async () => {
      let resolveCommit: (value: any) => void;
      mockSubmitCommitment.mockReturnValue(
        new Promise((resolve) => {
          resolveCommit = resolve;
        })
      );

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const input = await screen.findByLabelText(/amount \(usdc\)/i);
      fireEvent.change(input, { target: { value: "25" } });
      fireEvent.click(screen.getByRole("button", { name: /commit payment/i }));

      expect(
        screen.getByRole("button", { name: /submitting commitment/i })
      ).toBeInTheDocument();

      resolveCommit!({ txHash: "tx" });
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /submitting commitment/i })
        ).not.toBeInTheDocument()
      );
    });

    it("shows error on commitment failure and allows retry", async () => {
      mockSubmitCommitment.mockRejectedValue(new Error("Network error"));

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const input = await screen.findByLabelText(/amount \(usdc\)/i);
      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.click(screen.getByRole("button", { name: /commit payment/i }));

      expect(await screen.findByText(/network error/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /commit payment/i })
      ).toBeInTheDocument();

      mockSubmitCommitment.mockResolvedValue({ txHash: "tx_456" });
      fireEvent.click(screen.getByRole("button", { name: /commit payment/i }));
      expect(
        await screen.findByText(/commitment submitted successfully/i)
      ).toBeInTheDocument();
    });
  });

  describe("reveal flow", () => {
    it("reveals successfully and shows completed state", async () => {
      mockHasBlindingFactor.mockReturnValue(true);
      mockLoadCommittedAmount.mockReturnValue("75");
      mockLoadBlindingFactor.mockReturnValue("blinding_123");
      mockRevealPayment.mockResolvedValue({ txHash: "tx_reveal_123" });

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const revealButton = await screen.findByRole("button", {
        name: /reveal payment/i,
      });
      fireEvent.click(revealButton);

      expect(
        await screen.findByText(/payment revealed successfully/i)
      ).toBeInTheDocument();
      expect(mockLoadBlindingFactor).toHaveBeenCalledWith(
        mockInvoiceId,
        mockPublicKey
      );
      expect(mockRevealPayment).toHaveBeenCalledWith({
        payer: mockPublicKey,
        invoiceId: mockInvoiceId,
        amount: 750_000_000n,
        blindingFactor: "blinding_123",
      });
      expect(mockMarkRevealed).toHaveBeenCalledWith(
        mockInvoiceId,
        mockPublicKey
      );
    });

    it("shows error on reveal failure", async () => {
      mockHasBlindingFactor.mockReturnValue(true);
      mockLoadCommittedAmount.mockReturnValue("10");
      mockLoadBlindingFactor.mockReturnValue("blinding_456");
      mockRevealPayment.mockRejectedValue(new Error("Reveal failed"));

      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      const revealButton = await screen.findByRole("button", {
        name: /reveal payment/i,
      });
      fireEvent.click(revealButton);

      expect(await screen.findByText(/reveal failed/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reveal payment/i })
      ).toBeInTheDocument();
    });
  });

  describe("user copy", () => {
    it("shows explanatory text about confidential payments", async () => {
      render(
        <ConfidentialPaymentFlow
          invoiceId={mockInvoiceId}
          publicKey={mockPublicKey}
        />
      );
      expect(
        await screen.findByText(/cryptographic commitment is stored/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/recovery secret.*is stored in your browser/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/two steps are needed/i)
      ).toBeInTheDocument();
    });
  });
});
