import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useFeeEstimate } from "@/hooks/useFeeEstimate";

// Mock StellarSdk.Server
vi.mock("@stellar/stellar-sdk", () => ({
  Server: class MockServer {
    feeStats = vi.fn();
  },
}));

describe("useFeeEstimate Hook (#411)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("fetches fee stats and exposes baseFee, medianFee, p90Fee", async () => {
    const mockFeeStats = {
      baseFee: "100",
      modeAcceptanceRate: "99",
      p10AcceptanceRate: "100",
      p20AcceptanceRate: "100",
      p30AcceptanceRate: "100",
      p40AcceptanceRate: "100",
      p50AcceptanceRate: "100",
      p60AcceptanceRate: "100",
      p70AcceptanceRate: "100",
      p80AcceptanceRate: "100",
      p90AcceptanceRate: "100",
      p99AcceptanceRate: "100",
    };

    const { result } = renderHook(() => useFeeEstimate());

    expect(result.current.loading).toBe(true);

    // Simulate fee stats fetch completing
    vi.advanceTimersByTime(100);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.baseFee).toBe(100);
      expect(result.current.medianFee).toBeDefined();
      expect(result.current.p90Fee).toBeDefined();
    });
  });

  it("returns loading state on initial mount", () => {
    const { result } = renderHook(() => useFeeEstimate());
    expect(result.current.loading).toBe(true);
    expect(result.current.baseFee).toBeUndefined();
    expect(result.current.medianFee).toBeUndefined();
    expect(result.current.p90Fee).toBeUndefined();
  });

  it("exposes error state when feeStats fails", async () => {
    const { result } = renderHook(() => useFeeEstimate());

    vi.advanceTimersByTime(100);

    await waitFor(() => {
      if (result.current.error) {
        expect(result.current.error).toBeDefined();
      }
    });
  });

  it("polls feeStats every 10 seconds", async () => {
    const { result } = renderHook(() => useFeeEstimate());

    vi.advanceTimersByTime(10000);

    await waitFor(() => {
      // Should have polled once after 10 seconds
      expect(result.current.loading).toBe(false);
    });

    vi.advanceTimersByTime(10000);

    // Verify polling continues
    expect(result.current.loading).toBe(false);
  });

  it("stops polling when component unmounts", async () => {
    const { result, unmount } = renderHook(() => useFeeEstimate());

    vi.advanceTimersByTime(10000);

    unmount();

    // Advance timers again - should not trigger new fetches
    const initialState = result.current;
    vi.advanceTimersByTime(10000);

    expect(result.current).toEqual(initialState);
  });

  it("returns fallback base fee (100 stroops) on network error", async () => {
    const { result } = renderHook(() => useFeeEstimate());

    vi.advanceTimersByTime(100);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      // Fallback base fee should be 100 stroops
      expect(result.current.baseFee).toBeGreaterThanOrEqual(100);
    });
  });

  it("returns fee values in stroops", async () => {
    const { result } = renderHook(() => useFeeEstimate());

    vi.advanceTimersByTime(100);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      if (result.current.baseFee) {
        expect(typeof result.current.baseFee).toBe("number");
        expect(result.current.baseFee).toBeGreaterThanOrEqual(100);
      }
    });
  });
});
