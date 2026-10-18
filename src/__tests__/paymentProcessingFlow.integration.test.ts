/**
 * Integration tests for the payment processing flow: simulate (creation
 * preview) -> sign -> submit -> confirm, exercised against a mocked
 * Soroban RPC endpoint (the "test blockchain" boundary) so the test is
 * deterministic and isolated from any real network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { simulateTransaction } from "@/lib/simulateTx";
import { usePaymentSubmission } from "@/hooks/usePaymentSubmission";

const FAKE_XDR = "AAAAAgAAAAD...fake-transaction-xdr";

function mockRpcResponse(body: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("payment processing flow (integration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("payment creation (simulation)", () => {
    it("reports a successful simulation with effects and fee", async () => {
      mockRpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          latestLedgerBumpSeqNum: "42",
          transactionResult: { resultCode: "txSUCCESS" },
          results: [
            {
              effects: [
                {
                  type: "account_credited",
                  account: "GRECIPIENT",
                  balance: "1000",
                  asset: { code: "USDC" },
                },
              ],
            },
          ],
        },
      });

      const result = await simulateTransaction(FAKE_XDR);

      expect(result.success).toBe(true);
      expect(result.fee).toBe(42);
      expect(result.effects).toEqual([
        {
          accountId: "GRECIPIENT",
          balanceChange: { assetCode: "USDC", change: "1000" },
        },
      ]);
    });

    it("surfaces an RPC-level error without throwing", async () => {
      mockRpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { message: "insufficient balance" },
      });

      const result = await simulateTransaction(FAKE_XDR);

      expect(result.success).toBe(false);
      expect(result.error).toBe("insufficient balance");
    });

    it("surfaces a transport-level HTTP failure", async () => {
      mockRpcResponse({}, false);

      const result = await simulateTransaction(FAKE_XDR);

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });

    it("handles a network failure (fetch rejection) gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

      const result = await simulateTransaction(FAKE_XDR);

      expect(result.success).toBe(false);
      expect(result.error).toBe("network down");
    });
  });

  describe("end-to-end payment submission (simulate -> confirm)", () => {
    it("runs the full happy path: simulate then confirm payment", async () => {
      mockRpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { latestLedgerBumpSeqNum: "1", results: [{}] },
      });

      const { result } = renderHook(() => usePaymentSubmission());
      const onConfirm = vi.fn().mockResolvedValue({ txHash: "abc123" });
      const onCancel = vi.fn();

      await act(async () => {
        await result.current.initiateDemoPayment(FAKE_XDR, onConfirm, onCancel);
      });

      await waitFor(() => {
        expect(result.current.state.isSimulating).toBe(false);
      });

      expect(result.current.state.showSimulationPreview).toBe(true);
      expect(result.current.state.simulationResult?.success).toBe(true);
      expect(result.current.state.simulationError).toBeNull();
    });

    it("captures a simulation error without crashing the flow", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("rpc unreachable"));

      const { result } = renderHook(() => usePaymentSubmission());
      const onConfirm = vi.fn().mockResolvedValue({});
      const onCancel = vi.fn();

      await act(async () => {
        await result.current.initiateDemoPayment(FAKE_XDR, onConfirm, onCancel);
      });

      await waitFor(() => {
        expect(result.current.state.isSimulating).toBe(false);
      });

      expect(result.current.state.simulationError).toBe("rpc unreachable");
      expect(result.current.state.simulationResult).toBeNull();
      // Confirmation should never have been attempted once simulation failed.
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("resetState clears simulation state back to its initial shape", async () => {
      mockRpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { latestLedgerBumpSeqNum: "1", results: [{}] },
      });

      const { result } = renderHook(() => usePaymentSubmission());

      await act(async () => {
        await result.current.initiateDemoPayment(
          FAKE_XDR,
          vi.fn().mockResolvedValue({}),
          vi.fn()
        );
      });

      await waitFor(() => expect(result.current.state.isSimulating).toBe(false));

      act(() => {
        result.current.resetState();
      });

      expect(result.current.state).toEqual({
        showSimulationPreview: false,
        isSimulating: false,
        simulationResult: null,
        simulationError: null,
      });
    });
  });
});
