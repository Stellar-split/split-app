import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QRModal from "@/components/QRModal";

vi.mock("@/lib/freighter", () => ({
  isWalletConnected: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/components/FocusTrap", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value }: { value: string }) => (
    <canvas data-testid={`qr-code-${value}`} />
  ),
}));

describe("Issue #600: QRModal Download QR Code", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should render QR modal when open is true", () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/scan to connect/i)).toBeInTheDocument();
  });

  it("should render QR code canvas", () => {
    const onClose = vi.fn();
    const testUri = "wc:test-uri-123";

    render(
      <QRModal
        open={true}
        uri={testUri}
        onClose={onClose}
      />
    );

    expect(screen.getByTestId(`qr-code-${testUri}`)).toBeInTheDocument();
  });

  it("should display the URI as plain text", () => {
    const testUri = "wc:1234567890abcdef";
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri={testUri}
        onClose={onClose}
      />
    );

    expect(screen.getByText(testUri)).toBeInTheDocument();
  });

  it("should render Copy URI button", () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: /copy uri/i })).toBeInTheDocument();
  });

  it("should allow copying URI to clipboard", async () => {
    const testUri = "wc:test-uri";
    const onClose = vi.fn();
    const onCopied = vi.fn();

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      configurable: true,
    });

    render(
      <QRModal
        open={true}
        uri={testUri}
        onClose={onClose}
        onCopied={onCopied}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy uri/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testUri);
    });
  });

  it("should call onCopied callback after copying URI", async () => {
    const testUri = "wc:test-uri";
    const onClose = vi.fn();
    const onCopied = vi.fn();

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      configurable: true,
    });

    render(
      <QRModal
        open={true}
        uri={testUri}
        onClose={onClose}
        onCopied={onCopied}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy uri/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(onCopied).toHaveBeenCalled();
    });
  });

  it("should render Dismiss button", () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    const dismissButtons = screen.getAllByRole("button", { name: /dismiss/i });
    expect(dismissButtons.length).toBeGreaterThan(0);
  });

  it("should close modal when Dismiss button is clicked", async () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    const dismissButton = screen.getAllByRole("button", { name: /dismiss/i })[0];
    fireEvent.click(dismissButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should close modal when close button in header is clicked", async () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText(/close qr modal/i);
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should not render when open is false", () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRModal
        open={false}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should have proper ARIA attributes", () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should poll wallet connection status", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();

    const { isWalletConnected } = await import("@/lib/freighter");

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
        onConnected={onConnected}
        pollingInterval={2000}
      />
    );

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(isWalletConnected).toHaveBeenCalled();
    });
  });

  it("should call onConnected when wallet becomes connected", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();

    const { isWalletConnected } = await import("@/lib/freighter");
    vi.mocked(isWalletConnected).mockResolvedValueOnce(true);

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
        onConnected={onConnected}
        pollingInterval={2000}
      />
    );

    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalled();
    });
  });

  it("should stop polling when modal is closed", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();

    const { isWalletConnected } = await import("@/lib/freighter");
    vi.mocked(isWalletConnected).mockResolvedValue(true);

    const { rerender } = render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
        onConnected={onConnected}
        pollingInterval={2000}
      />
    );

    vi.advanceTimersByTime(2000);

    rerender(
      <QRModal
        open={false}
        uri="wc:test-uri"
        onClose={onClose}
        onConnected={onConnected}
        pollingInterval={2000}
      />
    );

    const callCountAfterClose = vi.mocked(isWalletConnected).mock.calls.length;

    vi.advanceTimersByTime(2000);

    const callCountAfterWait = vi.mocked(isWalletConnected).mock.calls.length;

    expect(callCountAfterWait).toBe(callCountAfterClose);
  });

  it("should respect custom polling interval", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();

    const { isWalletConnected } = await import("@/lib/freighter");
    vi.mocked(isWalletConnected).mockResolvedValue(false);

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
        onConnected={onConnected}
        pollingInterval={500}
      />
    );

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(vi.mocked(isWalletConnected).mock.calls.length).toBeGreaterThan(0);
    });
  });

  it("should display heading with scan instruction", () => {
    const onClose = vi.fn();

    render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/scan to connect/i)).toBeInTheDocument();
  });

  it("should have visual styling for draggable QR container", () => {
    const onClose = vi.fn();

    const { container } = render(
      <QRModal
        open={true}
        uri="wc:test-uri"
        onClose={onClose}
      />
    );

    const qrContainer = container.querySelector(".bg-white.rounded-xl");
    expect(qrContainer).toBeInTheDocument();
  });
});
