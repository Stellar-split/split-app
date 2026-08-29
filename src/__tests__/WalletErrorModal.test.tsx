import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalletErrorModal from "@/components/WalletErrorModal";

describe("Issue #599: WalletErrorModal retry functionality", () => {
  it("should not render when errorType is null", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    const { container } = render(
      <WalletErrorModal
        errorType={null}
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render not installed error state", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="not_installed"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/freighter not installed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/freighter is a browser extension/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /install freighter/i })
    ).toBeInTheDocument();
  });

  it("should render locked wallet error state", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/freighter is locked/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your freighter wallet is locked/i)
    ).toBeInTheDocument();
  });

  it("should render locked wallet error with Try Again button", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();
  });

  it("should call onRetry when Try Again button is clicked", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(tryAgainButton);

    expect(onRetry).toHaveBeenCalled();
  });

  it("should render network mismatch error state", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="network_mismatch"
        onDismiss={onDismiss}
        onRetry={onRetry}
        expectedNetwork="Mainnet"
      />
    );

    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
    const mainnetTexts = screen.getAllByText(/mainnet/i);
    expect(mainnetTexts.length).toBeGreaterThan(0);
  });

  it("should render network mismatch error with Got it button", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="network_mismatch"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const gotItButton = screen.getByRole("button", { name: /got it/i });
    expect(gotItButton).toBeInTheDocument();
  });

  it("should call onDismiss when Dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const dismissButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it("should dismiss modal when Escape key is pressed", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalled();
  });

  it("should dismiss modal when clicking on overlay background", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    const { container } = render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const overlayBackground = container.querySelector(".fixed.inset-0");
    if (overlayBackground) {
      fireEvent.click(overlayBackground, {
        target: overlayBackground,
        currentTarget: overlayBackground,
      });
    }

    expect(onDismiss).toHaveBeenCalled();
  });

  it("should have proper ARIA attributes for accessibility", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    const { container } = render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "wallet-error-title");
  });

  it("should focus first interactive element when error is shown", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    await waitFor(() => {
      const firstButton = screen.getByRole("button", { name: /try again/i });
      expect(firstButton).toHaveFocus();
    });
  });

  it("should restore focus when error is cleared", async () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    const { rerender } = render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const previouslyFocused = document.activeElement;

    rerender(
      <WalletErrorModal
        errorType={null}
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    await waitFor(() => {
      expect(document.activeElement).not.toBe(previouslyFocused);
    });
  });

  it("should use default expectedNetwork when not provided", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="network_mismatch"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const testnetTexts = screen.getAllByText(/testnet/i);
    expect(testnetTexts.length).toBeGreaterThan(0);
  });

  it("should use custom expectedNetwork when provided", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="network_mismatch"
        onDismiss={onDismiss}
        onRetry={onRetry}
        expectedNetwork="Custom Chain"
      />
    );

    const customChainTexts = screen.getAllByText(/custom chain/i);
    expect(customChainTexts.length).toBeGreaterThan(0);
  });

  it("should display install link for not_installed error", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="not_installed"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    const installLink = screen.getByRole("link", {
      name: /install freighter/i,
    });
    expect(installLink).toHaveAttribute(
      "href",
      "https://www.freighter.app/"
    );
    expect(installLink).toHaveAttribute("target", "_blank");
    expect(installLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should display instructions for locked wallet", () => {
    const onDismiss = vi.fn();
    const onRetry = vi.fn();

    render(
      <WalletErrorModal
        errorType="locked"
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/click the freighter icon/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your freighter password/i)).toBeInTheDocument();
    expect(screen.getByText(/return here and click/i)).toBeInTheDocument();
  });
});
