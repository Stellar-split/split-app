import React from "react";
import { render, screen } from "@testing-library/react";
import PaymentProgress from "@/components/PaymentProgress";

vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
}));

describe("PaymentProgress", () => {
  test("renders progress bar with correct aria-valuenow when partially funded", () => {
    render(
      <PaymentProgress
        funded={50_000_000n}
        total={100_000_000n}
      />
    );
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  test("caps progress bar width at 100% when overpaid", () => {
    render(
      <PaymentProgress
        funded={150_000_000n}
        total={100_000_000n}
      />
    );
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");

    const fillDiv = progressBar.querySelector("div");
    expect(fillDiv).toHaveStyle({ width: "100%" });
  });

  test("shows 0% when no funds received", () => {
    render(
      <PaymentProgress
        funded={0n}
        total={100_000_000n}
      />
    );
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  test("displays funded and total amounts in USDC", () => {
    const mockInvoice = {
      id: "inv-1",
      status: "Pending" as const,
      creator: "CREATOR",
      recipients: [{ address: "RECIP", amount: 100_000_000n }],
      token: "USDC",
      deadline: 0,
      funded: 50_000_000n,
      payments: [],
    };
    render(<PaymentProgress invoice={mockInvoice} />);
    expect(screen.getByText(/5\.00 \/ 10\.00 USDC funded/)).toBeInTheDocument();
  });

  test("uses invoice prop when provided", () => {
    const mockInvoice = {
      id: "inv-1",
      status: "Pending" as const,
      creator: "CREATOR",
      recipients: [{ address: "RECIP", amount: 100_000_000n }],
      token: "USDC",
      deadline: 0,
      funded: 75_000_000n,
      payments: [],
    };

    render(<PaymentProgress invoice={mockInvoice} />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText(/7\.50 \/ 10\.00 USDC funded/)).toBeInTheDocument();
  });

  test("aria-label describes funding percentage", () => {
    render(
      <PaymentProgress
        funded={50_000_000n}
        total={100_000_000n}
      />
    );
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-label", "50% funded");
  });

  test("does not display amount text without invoice prop", () => {
    render(
      <PaymentProgress
        funded={50_000_000n}
        total={100_000_000n}
      />
    );
    expect(screen.queryByText(/USDC funded/)).not.toBeInTheDocument();
  });

  test("handles edge case: total is zero", () => {
    render(
      <PaymentProgress
        funded={100_000_000n}
        total={0n}
      />
    );
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  test("correctly displays overpayment scenario", () => {
    const mockInvoice = {
      id: "inv-1",
      status: "Pending" as const,
      creator: "CREATOR",
      recipients: [{ address: "RECIP", amount: 100_000_000n }],
      token: "USDC",
      deadline: 0,
      funded: 150_000_000n,
      payments: [],
    };

    render(<PaymentProgress invoice={mockInvoice} />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(progressBar).toHaveAttribute("aria-label", "100% funded");
  });
});
