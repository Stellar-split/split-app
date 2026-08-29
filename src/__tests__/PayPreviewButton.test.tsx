import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import PayPreviewButton from "@/components/PayPreviewButton";

vi.mock("next/navigation");
vi.mock("@/lib/freighter");
vi.mock("@/hooks/useNetworkFeeBreakdown", () => ({
  useNetworkFeeBreakdown: vi.fn(),
}));

const mockPush = vi.fn();
(useRouter as any).mockReturnValue({
  push: mockPush,
});

import { getFreighterPublicKey } from "@/lib/freighter";
import { useNetworkFeeBreakdown } from "@/hooks/useNetworkFeeBreakdown";

describe("PayPreviewButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  test("renders pay button when invoice is Pending", () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );
    expect(screen.getByRole("button", { name: /Pay This Invoice/ })).toBeInTheDocument();
  });

  test("shows message when invoice is not Pending", () => {
    render(
      <PayPreviewButton invoiceId="inv-1" status="Released" />
    );
    expect(screen.getByText(/This invoice is released/i)).toBeInTheDocument();
  });

  test("navigates to pay page when button clicked and wallet connected", async () => {
    const user = userEvent.setup();
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    const button = screen.getByRole("button", { name: /Pay This Invoice/ });
    await user.click(button);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/pay/inv-1");
    });
  });

  test("prompts wallet connection when not connected", async () => {
    const user = userEvent.setup();
    vi.mocked(getFreighterPublicKey)
      .mockRejectedValueOnce(new Error("No wallet"))
      .mockResolvedValueOnce("GKEY123");

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    expect(screen.getByText(/Requires Freighter wallet extension/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Pay This Invoice/ });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Connecting wallet/i)).toBeInTheDocument();
    });
  });

  test("displays error when wallet connection fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getFreighterPublicKey).mockRejectedValue(
      new Error("Connection failed")
    );

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    const button = screen.getByRole("button", { name: /Pay This Invoice/ });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Could not connect wallet/i
      );
    });
  });

  test("displays estimated network fee when available", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    vi.mocked(useNetworkFeeBreakdown).mockReturnValue({
      fee: 100n,
      loading: false,
      error: null,
    });

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Est\. fee:/i)).toBeInTheDocument();
    });
  });

  test("shows skeleton loader while fee is loading", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    vi.mocked(useNetworkFeeBreakdown).mockReturnValue({
      fee: null,
      loading: true,
      error: null,
    });

    const { container } = render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      const skeleton = container.querySelector("[data-testid='fee-skeleton']");
      expect(skeleton).toBeInTheDocument();
    });
  });

  test("hides fee display when fetch fails", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    vi.mocked(useNetworkFeeBreakdown).mockReturnValue({
      fee: null,
      loading: false,
      error: new Error("Network error"),
    });

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Est\. fee:/i)).not.toBeInTheDocument();
    });
  });

  test("formats fee with XLM and USD equivalent", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");
    vi.mocked(useNetworkFeeBreakdown).mockReturnValue({
      fee: 100n,
      loading: false,
      error: null,
    });

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      expect(screen.getByText(/0\.00001 XLM ≈ \$0\.00/)).toBeInTheDocument();
    });
  });

  test("button shows connecting state during wallet connection", async () => {
    const user = userEvent.setup();
    vi.mocked(getFreighterPublicKey).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve("GKEY123"), 100))
    );

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    const button = screen.getByRole("button", { name: /Pay This Invoice/ });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connecting wallet/i })).toBeInTheDocument();
    });
  });

  test("calls getFreighterPublicKey on mount", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      expect(getFreighterPublicKey).toHaveBeenCalled();
    });
  });

  test("does not show Freighter requirement message when wallet is connected", async () => {
    vi.mocked(getFreighterPublicKey).mockResolvedValue("GKEY123");

    render(
      <PayPreviewButton invoiceId="inv-1" status="Pending" />
    );

    await waitFor(() => {
      expect(
        screen.queryByText(/Requires Freighter wallet extension/i)
      ).not.toBeInTheDocument();
    });
  });
});
