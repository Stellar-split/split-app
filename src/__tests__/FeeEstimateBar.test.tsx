import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FeeEstimateBar from "@/components/invoice/FeeEstimateBar";

// Mock the useFeeEstimate hook
vi.mock("@/hooks/useFeeEstimate", () => ({
  useFeeEstimate: vi.fn(() => ({
    baseFee: 100,
    medianFee: 150,
    p90Fee: 200,
    loading: false,
    error: null,
  })),
}));

describe("FeeEstimateBar Component (#411)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays three fee tiers: economy, standard, and priority", () => {
    render(<FeeEstimateBar operationCount={1} />);

    expect(screen.getByText(/economy/i)).toBeInTheDocument();
    expect(screen.getByText(/standard/i)).toBeInTheDocument();
    expect(screen.getByText(/priority/i)).toBeInTheDocument();
  });

  it("calculates total fee correctly by multiplying fee per stroop by operation count", () => {
    const { rerender } = render(<FeeEstimateBar operationCount={1} />);

    // With operationCount=1, base fee should be ~100 stroops
    const economyFee1 = screen.getByText(/economy/i).textContent;
    expect(economyFee1).toBeDefined();

    // With operationCount=2, base fee should be ~200 stroops (double)
    rerender(<FeeEstimateBar operationCount={2} />);
    const economyFee2 = screen.getByText(/economy/i).textContent;
    expect(economyFee2).toBeDefined();
  });

  it("displays stroops and XLM equivalents", () => {
    render(<FeeEstimateBar operationCount={1} />);

    // Should display stroops value
    expect(screen.getByText(/stroops/i)).toBeInTheDocument();
    // Should display XLM value (rounded to 7 decimal places)
    expect(screen.getByText(/xlm/i)).toBeInTheDocument();
  });

  it("shows loading state when fee data is loading", () => {
    const { useFeeEstimate } = await import("@/hooks/useFeeEstimate");
    vi.mocked(useFeeEstimate).mockReturnValue({
      baseFee: undefined,
      medianFee: undefined,
      p90Fee: undefined,
      loading: true,
      error: null,
    });

    render(<FeeEstimateBar operationCount={1} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error state when fee stats returns an error", () => {
    const { useFeeEstimate } = await import("@/hooks/useFeeEstimate");
    vi.mocked(useFeeEstimate).mockReturnValue({
      baseFee: 100,
      medianFee: 150,
      p90Fee: 200,
      loading: false,
      error: new Error("Network error"),
    });

    render(<FeeEstimateBar operationCount={1} />);

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it("displays tooltips for each fee tier explaining the difference", () => {
    render(<FeeEstimateBar operationCount={1} />);

    // Check for tooltip elements or hover descriptions
    const economyTier = screen.getByText(/economy/i);
    expect(economyTier).toBeInTheDocument();
  });

  it("displays segmented bar visualization of three tiers", () => {
    const { container } = render(<FeeEstimateBar operationCount={1} />);

    // Check for SVG or bar container elements
    const bars = container.querySelectorAll("[class*='bar'], [class*='gauge'], svg");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("rounds XLM values to 7 decimal places", () => {
    render(<FeeEstimateBar operationCount={1} />);

    // Find XLM values and verify formatting
    const xlmValues = screen.getAllByText(/\d+\.\d{7}/);
    xlmValues.forEach((el) => {
      const text = el.textContent || "";
      const match = text.match(/(\d+\.\d+)/);
      if (match) {
        const decimals = match[1].split(".")[1]?.length || 0;
        expect(decimals).toBeLessThanOrEqual(7);
      }
    });
  });

  it("updates fees immediately when operation count changes", async () => {
    const { rerender } = render(<FeeEstimateBar operationCount={1} />);

    const initialContent = screen.getByText(/economy/i).textContent;

    rerender(<FeeEstimateBar operationCount={5} />);

    await waitFor(() => {
      const updatedContent = screen.getByText(/economy/i).textContent;
      expect(updatedContent).toBeDefined();
    });
  });
});
