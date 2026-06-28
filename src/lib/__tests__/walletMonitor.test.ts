import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startWalletPolling,
  stopWalletPolling,
  subscribeToWalletChanges,
  setLastKnownAddress,
  getLastKnownAddress,
} from "../walletMonitor";
import * as freighter from "../freighter";

vi.mock("../freighter");

describe("walletMonitor", () => {
  beforeEach(() => {
    setLastKnownAddress(null);
    stopWalletPolling();
  });

  afterEach(() => {
    stopWalletPolling();
    vi.clearAllMocks();
  });

  describe("subscribeToWalletChanges", () => {
    it("should call callback on address change", async () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToWalletChanges(callback);

      vi.mocked(freighter.getFreighterPublicKey).mockResolvedValue(
        "GADDRESS1"
      );

      startWalletPolling(50);
      await new Promise((r) => setTimeout(r, 100));

      expect(callback).toHaveBeenCalledWith({
        publicKey: "GADDRESS1",
        isConnected: true,
      });

      unsubscribe();
      stopWalletPolling();
    });

    it("should call callback on disconnect", async () => {
      const callback = vi.fn();
      subscribeToWalletChanges(callback);

      vi.mocked(freighter.getFreighterPublicKey).mockResolvedValue(
        "GADDRESS1"
      );

      startWalletPolling(50);
      await new Promise((r) => setTimeout(r, 100));

      vi.mocked(freighter.getFreighterPublicKey).mockRejectedValue(
        new Error("Disconnected")
      );

      await new Promise((r) => setTimeout(r, 100));

      expect(callback).toHaveBeenCalledWith({
        publicKey: null,
        isConnected: false,
      });

      stopWalletPolling();
    });

    it("should call callback on account switch", async () => {
      const callback = vi.fn();
      subscribeToWalletChanges(callback);

      vi.mocked(freighter.getFreighterPublicKey).mockResolvedValue(
        "GADDRESS1"
      );

      startWalletPolling(50);
      await new Promise((r) => setTimeout(r, 100));

      vi.mocked(freighter.getFreighterPublicKey).mockResolvedValue(
        "GADDRESS2"
      );

      await new Promise((r) => setTimeout(r, 100));

      const calls = callback.mock.calls;
      expect(calls[calls.length - 1][0]).toEqual({
        publicKey: "GADDRESS2",
        isConnected: true,
      });

      stopWalletPolling();
    });
  });

  describe("getLastKnownAddress", () => {
    it("should return last known address", () => {
      setLastKnownAddress("GADDRESS1");
      expect(getLastKnownAddress()).toBe("GADDRESS1");
    });
  });
});
