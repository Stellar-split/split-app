import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockSimulateTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/simulateTx", () => ({
  simulateTransaction: mockSimulateTransaction,
}));

import {
  usePaymentSubmission,
  isRateLockExpired,
} from "../usePaymentSubmission";

describe("isRateLockExpired", () => {
  it("returns false when there is no rate lock", () => {
    expect(isRateLockExpired(null)).toBe(false);
    expect(isRateLockExpired(undefined)).toBe(false);
  });

  it("returns false before expiry", () => {
    const lock = { currency: "USD", rate: 0.1, expiresAt: 1000 };
    expect(isRateLockExpired(lock, 500)).toBe(false);
  });

  it("returns true at or after expiry", () => {
    const lock = { currency: "USD", rate: 0.1, expiresAt: 1000 };
    expect(isRateLockExpired(lock, 1000)).toBe(true);
    expect(isRateLockExpired(lock, 1500)).toBe(true);
  });
});

describe("usePaymentSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  it("initializes with a clean state", () => {
    const { result } = renderHook(() => usePaymentSubmission());
    expect(result.current.state).toEqual({
      showSimulationPreview: false,
      isSimulating: false,
      simulationResult: null,
      simulationError: null,
      rateLockExpired: false,
    });
  });

  it("runs a simulation and stores the result on initiateDemoPayment", async () => {
    mockSimulateTransaction.mockResolvedValue({
      success: true,
      fee: 100,
      effects: [],
    });

    const { result } = renderHook(() => usePaymentSubmission());
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    await act(async () => {
      await result.current.initiateDemoPayment("xdr-123", onConfirm, onCancel);
    });

    expect(mockSimulateTransaction).toHaveBeenCalledWith("xdr-123");
    expect(result.current.state.showSimulationPreview).toBe(true);
    expect(result.current.state.isSimulating).toBe(false);
    expect(result.current.state.simulationResult).toEqual({
      success: true,
      fee: 100,
      effects: [],
    });
    expect(result.current.state.simulationError).toBeNull();
  });

  it("surfaces a simulation error without throwing", async () => {
    mockSimulateTransaction.mockRejectedValue(new Error("RPC unreachable"));

    const { result } = renderHook(() => usePaymentSubmission());

    await act(async () => {
      await result.current.initiateDemoPayment(
        "xdr-bad",
        vi.fn(),
        vi.fn(),
      );
    });

    expect(result.current.state.isSimulating).toBe(false);
    expect(result.current.state.simulationError).toBe("RPC unreachable");
  });

  it("blocks initiation when the rate lock has already expired", async () => {
    const { result } = renderHook(() => usePaymentSubmission());
    const expiredLock = { currency: "USD", rate: 0.1, expiresAt: 1 };

    await act(async () => {
      await result.current.initiateDemoPayment(
        "xdr-123",
        vi.fn(),
        vi.fn(),
        { rateLock: expiredLock },
      );
    });

    expect(mockSimulateTransaction).not.toHaveBeenCalled();
    expect(result.current.state.rateLockExpired).toBe(true);
    expect(result.current.state.simulationError).toMatch(/rate lock/i);
  });

  it("resetState clears simulation state back to defaults", async () => {
    mockSimulateTransaction.mockResolvedValue({
      success: true,
      fee: 1,
      effects: [],
    });
    const { result } = renderHook(() => usePaymentSubmission());

    await act(async () => {
      await result.current.initiateDemoPayment("xdr", vi.fn(), vi.fn());
    });
    expect(result.current.state.showSimulationPreview).toBe(true);

    act(() => {
      result.current.resetState();
    });

    expect(result.current.state).toEqual({
      showSimulationPreview: false,
      isSimulating: false,
      simulationResult: null,
      simulationError: null,
      rateLockExpired: false,
    });
  });
});
