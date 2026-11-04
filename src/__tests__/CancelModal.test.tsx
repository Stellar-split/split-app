import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import CancelModal from "@/components/CancelModal";

vi.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("CancelModal multi-step confirmation flow and gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Step 1 (warning) with consequences explained and zero-refund details", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CancelModal
        invoiceId="42"
        invoiceTitle="Design Work Q3"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByTestId("step-warn")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Are you sure you want to cancel this invoice\?/i)).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Zero payments received:/i)).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Keep Invoice/i)).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Continue/i)).toBeTruthy() // element exists in DOM;
  });

  it("navigates to Step 2 (title confirmation gate) on Continue click", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CancelModal
        invoiceId="42"
        invoiceTitle="Design Work Q3"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText(/Continue/i));

    expect(screen.getByTestId("step-confirm-gate")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Design Work Q3")).toBeTruthy() // element exists in DOM;

    const confirmButton = screen.getByRole("button", { name: /Confirm Cancel/i });
    expect(confirmButton).toBeDisabled();
  });

  it("enables the Confirm Cancel button only when the matching title is typed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CancelModal
        invoiceId="42"
        invoiceTitle="Design Work Q3"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText(/Continue/i));

    const input = screen.getByRole("textbox");
    const confirmButton = screen.getByRole("button", { name: /Confirm Cancel/i });

    // Incorrect text
    await user.type(input, "Wrong Title");
    expect(confirmButton).toBeDisabled();

    // Clear and type correct title
    await user.clear(input);
    await user.type(input, "Design Work Q3");
    expect(confirmButton).toBeEnabled();
  });

  it("executes SDK call and transitions to Step 4 (success state)", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void = () => {};
    const onConfirm = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        })
    );
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <CancelModal
        invoiceId="42"
        invoiceTitle="Design Work Q3"
        onConfirm={onConfirm}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText(/Continue/i));

    const input = screen.getByRole("textbox");
    await user.type(input, "Design Work Q3");

    const confirmButton = screen.getByRole("button", { name: /Confirm Cancel/i });
    fireEvent.click(confirmButton);

    // Step 3: loading state
    expect(screen.getByTestId("step-loading")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Cancelling invoice on-chain\.\.\./i)).toBeTruthy() // element exists in DOM;

    // Resolve the onConfirm promise
    resolvePromise();

    // Step 4: success state
    await waitFor(() => {
      const successStep = screen.getByTestId("step-success");
      expect(successStep).toBeTruthy() // element exists in DOM;
    });
  });
});
