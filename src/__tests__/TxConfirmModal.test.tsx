import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TxConfirmModal from "@/components/TxConfirmModal";

vi.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Issue #598: TxConfirmModal with Stellar Expert link", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render transaction confirmation message", () => {
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Payment"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/✓ payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText("Transaction hash")).toBeInTheDocument();
  });

  it("should display transaction hash", () => {
    const txHash = "1234567890abcdef";
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash={txHash}
        action="Transfer"
        onClose={onClose}
      />
    );

    expect(screen.getByText(txHash)).toBeInTheDocument();
  });

  it("should render link to Stellar Expert with proper URL structure", () => {
    const txHash = "abc123hash";
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash={txHash}
        action="Payment"
        onClose={onClose}
      />
    );

    const link = screen.getByRole("link", {
      name: /view on stellar expert/i,
    });
    expect(link).toHaveAttribute("href");
    const href = link.getAttribute("href");
    expect(href).toContain("stellar.expert/explorer");
    expect(href).toContain(`tx/${txHash}`);
  });

  it("should open Stellar Expert link in new tab with security attributes", () => {
    const txHash = "abc123hash";
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash={txHash}
        action="Payment"
        onClose={onClose}
      />
    );

    const link = screen.getByRole("link", {
      name: /view on stellar expert/i,
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should allow copying transaction hash", async () => {
    const txHash = "abcdef123456";
    const onClose = vi.fn();

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      configurable: true,
    });

    render(
      <TxConfirmModal
        txHash={txHash}
        action="Payment"
        onClose={onClose}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(txHash);
    });
  });

  it("should show 'Copied!' feedback after copying", async () => {
    const txHash = "abcdef123456";
    const onClose = vi.fn();

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      configurable: true,
    });

    vi.useFakeTimers();

    render(
      <TxConfirmModal
        txHash={txHash}
        action="Payment"
        onClose={onClose}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2001);

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("should close modal when close button is clicked", async () => {
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Payment"
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should close modal when clicking overlay background", async () => {
    const onClose = vi.fn();

    const { container } = render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Payment"
        onClose={onClose}
      />
    );

    const overlayContainer = container.querySelector(".fixed.inset-0");
    if (overlayContainer) {
      fireEvent.click(overlayContainer);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it("should render success indicator with green checkmark", () => {
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Payment"
        onClose={onClose}
      />
    );

    const title = screen.getByText(/✓ payment confirmed/i);
    expect(title).toHaveClass("text-green-400");
  });

  it("should display the correct action text in confirmation message", () => {
    const onClose = vi.fn();

    render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Withdrawal"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/✓ withdrawal confirmed/i)).toBeInTheDocument();
  });

  it("should be accessible with proper ARIA attributes", () => {
    const onClose = vi.fn();

    const { container } = render(
      <TxConfirmModal
        txHash="abc123hash"
        action="Payment"
        onClose={onClose}
      />
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "tx-modal-title");
  });
});
