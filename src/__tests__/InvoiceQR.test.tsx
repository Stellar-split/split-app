import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import InvoiceQR, { clampAmount, MIN_AMOUNT } from "@/components/InvoiceQR";

jest.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value }: { value: string }) => (
    <canvas data-testid="qr-canvas" data-value={value} />
  ),
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("clampAmount", () => {
  test("clamps below minimum to MIN_AMOUNT", () => {
    expect(clampAmount(0, 100)).toBe(MIN_AMOUNT);
    expect(clampAmount(-5, 100)).toBe(MIN_AMOUNT);
  });

  test("clamps above remaining balance", () => {
    expect(clampAmount(150, 100)).toBe(100);
  });

  test("returns value when in valid range", () => {
    expect(clampAmount(50, 100)).toBe(50);
  });

  test("handles NaN", () => {
    expect(clampAmount(NaN, 100)).toBe(MIN_AMOUNT);
  });

  test("rounds to 2 decimal places", () => {
    expect(clampAmount(10.126, 100)).toBe(10.13);
  });
});

describe("InvoiceQR component", () => {
  test("renders without amount input when no remainingBalance", () => {
    render(<InvoiceQR invoiceId="test-123" />);
    expect(screen.queryByLabelText(/payment amount/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("qr-canvas")).toBeInTheDocument();
  });

  test("shows amount input when remainingBalance is provided", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={100} />);
    expect(screen.getByLabelText(/payment amount/i)).toBeInTheDocument();
  });

  test("defaults amount to remaining balance", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={50} />);
    const input = screen.getByLabelText(/payment amount/i) as HTMLInputElement;
    expect(input.value).toBe("50");
  });

  test("shows validation error for amount exceeding balance", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={100} />);
    const input = screen.getByLabelText(/payment amount/i);
    fireEvent.change(input, { target: { value: "200" } });
    expect(screen.getByText(/maximum is 100/i)).toBeInTheDocument();
  });

  test("shows validation error for amount below minimum", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={100} />);
    const input = screen.getByLabelText(/payment amount/i);
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText(/minimum amount/i)).toBeInTheDocument();
  });

  test("QR regenerates with debounced amount", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={100} />);
    const input = screen.getByLabelText(/payment amount/i);
    fireEvent.change(input, { target: { value: "25" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const qr = screen.getByTestId("qr-canvas");
    expect(qr.getAttribute("data-value")).toContain("amount=25");
  });

  test("Full button resets to remaining balance", () => {
    render(<InvoiceQR invoiceId="test-123" remainingBalance={100} />);
    const input = screen.getByLabelText(/payment amount/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.click(screen.getByText("Full"));
    expect(input.value).toBe("100");
  });
});
