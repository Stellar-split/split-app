import { describe, test, expect } from "vitest";
import { SUPPORTED_CHAINS, estimateBridgeFee } from "@/lib/bridge";

// ─── SUPPORTED_CHAINS ────────────────────────────────────────────────────────

describe("SUPPORTED_CHAINS", () => {
  test("contains exactly two chains", () => {
    expect(SUPPORTED_CHAINS.length).toBe(2);
  });

  test("includes ethereum chain", () => {
    const eth = SUPPORTED_CHAINS.find((c) => c.id === "ethereum");
    expect(eth).toBeDefined();
    expect(eth!.label).toBe("Ethereum Mainnet");
    expect(eth!.currency).toBe("ETH");
    expect(eth!.walletName).toBe("MetaMask");
    expect(eth!.estimatedTime.length).toBeGreaterThan(0);
  });

  test("includes solana chain", () => {
    const sol = SUPPORTED_CHAINS.find((c) => c.id === "solana");
    expect(sol).toBeDefined();
    expect(sol!.label).toBe("Solana Mainnet");
    expect(sol!.currency).toBe("SOL");
    expect(sol!.walletName).toBe("Phantom");
    expect(sol!.estimatedTime.length).toBeGreaterThan(0);
  });

  test("each chain has all required fields", () => {
    const requiredFields = ["id", "label", "currency", "walletName", "estimatedTime"];
    for (const chain of SUPPORTED_CHAINS) {
      for (const field of requiredFields) {
        expect(chain).toHaveProperty(field);
      }
    }
  });

  test("chain ids are unique", () => {
    const ids = SUPPORTED_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── estimateBridgeFee — Ethereum ─────────────────────────────────────────────

describe("estimateBridgeFee — ethereum", () => {
  test("returns correct structure", () => {
    const result = estimateBridgeFee("ethereum", "100");
    expect(typeof result.bridgeFee).toBe("string");
    expect(typeof result.bridgeFeeRatio).toBe("number");
    expect(typeof result.netAmount).toBe("string");
    expect(typeof result.estimatedTime).toBe("string");
  });

  test("fee ratio is 0.3 % for ethereum", () => {
    expect(estimateBridgeFee("ethereum", "100").bridgeFeeRatio).toBe(0.003);
  });

  test("net amount is amount minus fee for ethereum", () => {
    expect(estimateBridgeFee("ethereum", "100").netAmount).toBe("99.700000");
  });

  test("net amount is correct for fractional input", () => {
    const result = estimateBridgeFee("ethereum", "50.5");
    expect(result.netAmount).toBe((50.5 - 50.5 * 0.003).toFixed(6));
  });

  test("bridgeFee string contains ETH", () => {
    expect(estimateBridgeFee("ethereum", "100").bridgeFee).toContain("ETH");
  });

  test("estimatedTime is non-empty string", () => {
    expect(estimateBridgeFee("ethereum", "100").estimatedTime.trim().length).toBeGreaterThan(0);
  });

  test("handles large amount", () => {
    const expected = (1_000_000 - 1_000_000 * 0.003).toFixed(6);
    expect(estimateBridgeFee("ethereum", "1000000").netAmount).toBe(expected);
  });

  test("handles zero amount — net is 0", () => {
    expect(parseFloat(estimateBridgeFee("ethereum", "0").netAmount)).toBe(0);
  });

  test("handles empty string amount — net is 0", () => {
    expect(parseFloat(estimateBridgeFee("ethereum", "").netAmount)).toBe(0);
  });

  test("net amount never goes negative", () => {
    expect(parseFloat(estimateBridgeFee("ethereum", "-50").netAmount)).toBeGreaterThanOrEqual(0);
  });
});

// ─── estimateBridgeFee — Solana ───────────────────────────────────────────────

describe("estimateBridgeFee — solana", () => {
  test("fee ratio is 0.1 % for solana", () => {
    expect(estimateBridgeFee("solana", "100").bridgeFeeRatio).toBe(0.001);
  });

  test("net amount is amount minus fee for solana", () => {
    expect(estimateBridgeFee("solana", "100").netAmount).toBe("99.900000");
  });

  test("bridgeFee string contains SOL", () => {
    expect(estimateBridgeFee("solana", "100").bridgeFee).toContain("SOL");
  });

  test("solana fee is lower than ethereum fee for same amount", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    expect(parseFloat(sol.netAmount)).toBeGreaterThan(parseFloat(eth.netAmount));
  });

  test("handles fractional input", () => {
    const expected = (200.25 - 200.25 * 0.001).toFixed(6);
    expect(estimateBridgeFee("solana", "200.25").netAmount).toBe(expected);
  });

  test("estimatedTime is non-empty string", () => {
    expect(estimateBridgeFee("solana", "100").estimatedTime.trim().length).toBeGreaterThan(0);
  });
});

// ─── estimateBridgeFee — cross-chain ─────────────────────────────────────────

describe("estimateBridgeFee — cross-chain", () => {
  test("both chains return matching structure shape", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    const keys = ["bridgeFee", "bridgeFeeRatio", "netAmount", "estimatedTime"];
    for (const key of keys) {
      expect(eth).toHaveProperty(key);
      expect(sol).toHaveProperty(key);
    }
  });

  test("estimatedTime differs between chains", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    expect(eth.estimatedTime).not.toBe(sol.estimatedTime);
  });

  test("net amount is a valid decimal string", () => {
    for (const chain of ["ethereum", "solana"] as const) {
      const result = estimateBridgeFee(chain, "123.456");
      expect(/^\d+\.\d+$/.test(result.netAmount)).toBe(true);
    }
  });
});
