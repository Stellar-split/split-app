import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentScheduler from "@/components/PaymentScheduler";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => localStorageMock.clear());

describe("PaymentScheduler (#800)", () => {
  const defaultProps = {
    invoiceId: "test-invoice-001",
    totalAmount: 1200,
    token: "USDC" as const,
  };

  it("renders setup view by default", () => {
    render(<PaymentScheduler {...defaultProps} />);
    expect(screen.getByText(/pay over time/i)).toBeInTheDocument();
  });

  it("renders amount, frequency and start date inputs", () => {
    render(<PaymentScheduler {...defaultProps} />);
    expect(screen.getByLabelText(/total amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment frequency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first payment date/i)).toBeInTheDocument();
  });

  it("shows instalment count input when frequency is not one-time", () => {
    render(<PaymentScheduler {...defaultProps} />);
    // Default is monthly
    expect(screen.getByLabelText(/number of instalments/i)).toBeInTheDocument();
  });

  it("hides instalment count when frequency is one-time", () => {
    render(<PaymentScheduler {...defaultProps} />);
    const freqSelect = screen.getByLabelText(/payment frequency/i) as HTMLSelectElement;
    fireEvent.change(freqSelect, { target: { value: "one-time" } });
    expect(screen.queryByLabelText(/number of instalments/i)).not.toBeInTheDocument();
  });

  it("shows schedule preview with correct number of rows", () => {
    render(<PaymentScheduler {...defaultProps} />);
    // Default: 3 monthly instalments
    expect(screen.getByText("Instalment 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Instalment 3 of 3")).toBeInTheDocument();
  });

  it("shows 'Full Payment' label for one-time schedule", () => {
    render(<PaymentScheduler {...defaultProps} />);
    const freqSelect = screen.getByLabelText(/payment frequency/i) as HTMLSelectElement;
    fireEvent.change(freqSelect, { target: { value: "one-time" } });
    expect(screen.getByText("Full Payment")).toBeInTheDocument();
  });

  it("shows Create Schedule button", () => {
    render(<PaymentScheduler {...defaultProps} />);
    expect(screen.getByRole("button", { name: /create schedule/i })).toBeInTheDocument();
  });

  it("switches to active view after creating schedule", () => {
    render(<PaymentScheduler {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    expect(screen.getByText(/payment schedule/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows progress bar at 0% initially", () => {
    render(<PaymentScheduler {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("marks instalment as paid and updates progress", () => {
    render(<PaymentScheduler {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    const payBtns = screen.getAllByRole("button", { name: /^pay$/i });
    fireEvent.click(payBtns[0]);
    // 1 of 3 = 33%
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
  });

  it("shows completion message when all instalments paid", () => {
    render(<PaymentScheduler {...defaultProps} />);
    // Use one-time so there's only 1 instalment
    const freqSelect = screen.getByLabelText(/payment frequency/i) as HTMLSelectElement;
    fireEvent.change(freqSelect, { target: { value: "one-time" } });
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    const payBtns = screen.getAllByRole("button", { name: /^pay$/i });
    fireEvent.click(payBtns[0]);
    expect(screen.getByText(/all instalments paid/i)).toBeInTheDocument();
  });

  it("calls onPayInstalment callback when paying", () => {
    const onPay = jest.fn();
    render(<PaymentScheduler {...defaultProps} onPayInstalment={onPay} />);
    const freqSelect = screen.getByLabelText(/payment frequency/i) as HTMLSelectElement;
    fireEvent.change(freqSelect, { target: { value: "one-time" } });
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /^pay$/i }));
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay.mock.calls[0][0]).toHaveProperty("status", "paid");
  });

  it("reset button returns to setup view", () => {
    render(<PaymentScheduler {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByText(/pay over time/i)).toBeInTheDocument();
  });

  it("shows error when amount is 0", () => {
    render(<PaymentScheduler {...defaultProps} totalAmount={0} />);
    const amountInput = screen.getByLabelText(/total amount/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));
    expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
  });

  it("distributes total correctly across instalments", () => {
    render(<PaymentScheduler {...defaultProps} totalAmount={300} />);
    // 3 monthly instalments of 300 → 100 each
    const items = screen.getAllByText(/100/);
    expect(items.length).toBeGreaterThan(0);
  });
});
