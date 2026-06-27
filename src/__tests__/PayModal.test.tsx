import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PayModal, { getPaymentErrorMessage } from "@/components/PayModal";
import type { Invoice } from "@stellar-split/sdk";

const SCALE = 10_000_000n;

jest.mock("@stellar-split/sdk", () => ({
  formatAmount: (value: bigint) => (Number(value) / 10_000_000).toFixed(2),
  parseAmount: (value: string) => BigInt(Math.round(Number(value) * 10_000_000)),
}));

jest.mock("@/lib/stellar", () => ({
  USDC_CONTRACT_ID: "CUSDC",
  fetchUsdcBalance: jest.fn().mockResolvedValue(1_000_000_000n),
}));

jest.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: function FocusTrap({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
}));

const invoice: Invoice = {
  id: "inv-286",
  creator: "GCREATOR",
  recipients: [{ address: "GPAYER", amount: 50n * SCALE }],
  token: "CUSDC",
  deadline: 0,
  funded: 25n * SCALE,
  status: "Pending",
  payments: [{ payer: "GPAYER", amount: 10n * SCALE }],
};

describe("PayModal", () => {
  it("defaults to remaining share, shows balance, pays with tip, and renders explorer link", async () => {
    const onPay = jest.fn().mockResolvedValue({ txHash: "abc123hash" });

    render(
      <PayModal
        invoice={invoice}
        total={100n * SCALE}
        publicKey="GPAYER"
        onPay={onPay}
        onClose={jest.fn()}
      />
    );

    const amountInput = await screen.findByLabelText(/amount \(usdc\)/i);
    expect(amountInput).toHaveValue(40);
    expect(await screen.findByText(/100.00 USDC available/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/tip \(optional\)/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByLabelText(/donate on failure/i));
    fireEvent.click(screen.getByRole("button", { name: /review & pay/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & pay/i }));

    await waitFor(() =>
      expect(onPay).toHaveBeenCalledWith(
        42n * SCALE,
        undefined,
        expect.objectContaining({ tip: 2n * SCALE, donateOnFailure: true })
      )
    );
    expect(await screen.findByText(/payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on stellar expert/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/abc123hash")
    );
  });

  it("maps known payment errors to human-readable messages", () => {
    expect(getPaymentErrorMessage("insufficient balance")).toMatch(/balance is too low/i);
    expect(getPaymentErrorMessage("invoice closed")).toMatch(/no longer accepting payments/i);
    expect(getPaymentErrorMessage("user rejected request")).toMatch(/signing request was cancelled/i);
  });
});
