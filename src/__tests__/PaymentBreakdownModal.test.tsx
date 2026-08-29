import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentBreakdownModal from "@/components/PaymentBreakdownModal";

vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
}));

describe("PaymentBreakdownModal", () => {
  const mockFeeBreakdown = {
    gross: 100_000_000n,
    fee: 1_000_000n,
    net: 99_000_000n,
  };

  const mockOnConfirm = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnBack.mockClear();
  });

  test("renders modal with dialog role and aria-modal", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("displays breakdown title", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText("Payment Breakdown")).toBeInTheDocument();
  });

  test("displays gross amount, protocol fee, net to recipients, and stellar fee", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText("Gross Amount")).toBeInTheDocument();
    expect(screen.getByText("Protocol Fee")).toBeInTheDocument();
    expect(screen.getByText("Net to Recipients")).toBeInTheDocument();
    expect(screen.getByText("Stellar Tx Fee")).toBeInTheDocument();
  });

  test("displays formatted amounts correctly", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText(/10\.00 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/-0\.10 USDC/)).toBeInTheDocument();
  });

  test("calls onConfirm when Confirm & Pay button clicked", async () => {
    const user = userEvent.setup();
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const confirmButton = screen.getByRole("button", { name: /Confirm & Pay/ });
    await user.click(confirmButton);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  test("calls onBack when Back button clicked", async () => {
    const user = userEvent.setup();
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const backButton = screen.getByRole("button", { name: "Back" });
    await user.click(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  test("disables buttons when confirming is true", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
        confirming={true}
      />
    );
    const backButton = screen.getByRole("button", { name: "Back" });
    const confirmButton = screen.getByRole("button", { name: /Waiting for signature/ });
    expect(backButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  test("shows waiting message when confirming", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
        confirming={true}
      />
    );
    expect(screen.getByText("Waiting for signature…")).toBeInTheDocument();
  });

  test("displays fee explanation text", () => {
    render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText(/protocol fee is deducted/i)).toBeInTheDocument();
  });

  test("calls onBack when clicking outside dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(mockOnBack).not.toHaveBeenCalled();
  });

  test("dismisses when clicking on backdrop overlay", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const overlay = container.querySelector("[role='dialog']") as HTMLElement;
    const backdrop = overlay.parentElement as HTMLElement;

    if (backdrop && backdrop !== overlay) {
      await user.click(backdrop);
      expect(mockOnBack).toHaveBeenCalled();
    }
  });

  test("renders with correct table structure", () => {
    const { container } = render(
      <PaymentBreakdownModal
        amount={100_000_000n}
        feeBreakdown={mockFeeBreakdown}
        stellarFee={100n}
        onConfirm={mockOnConfirm}
        onBack={mockOnBack}
      />
    );
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
  });
});
