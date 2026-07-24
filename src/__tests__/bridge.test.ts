/**
 * Unit tests for bridge fee estimation and chain selector logic.
 *
 * Run with:
 *   npm test
 *
 * Uses Node.js built-in test runner (node:test) — no additional dependencies
 * required. Sucrase transpiles TypeScript at runtime.
 */
const { test, describe } = require("node:test") as typeof import("node:test");
const assert = require("node:assert") as typeof import("node:assert");

const {
  SUPPORTED_CHAINS,
  estimateBridgeFee,
} = require("../lib/bridge.ts") as typeof import("../lib/bridge");

// ─── SUPPORTED_CHAINS ────────────────────────────────────────────────────────

describe("SUPPORTED_CHAINS", () => {
  test("contains exactly two chains", () => {
    assert.strictEqual(SUPPORTED_CHAINS.length, 2);
  });

  test("includes ethereum chain", () => {
    const eth = SUPPORTED_CHAINS.find(
      (c: { id: string }) => c.id === "ethereum"
    );
    assert.ok(eth, "ethereum chain not found");
    assert.strictEqual(eth.label, "Ethereum Mainnet");
    assert.strictEqual(eth.currency, "ETH");
    assert.strictEqual(eth.walletName, "MetaMask");
    assert.ok(eth.estimatedTime.length > 0);
  });

  test("includes solana chain", () => {
    const sol = SUPPORTED_CHAINS.find(
      (c: { id: string }) => c.id === "solana"
    );
    assert.ok(sol, "solana chain not found");
    assert.strictEqual(sol.label, "Solana Mainnet");
    assert.strictEqual(sol.currency, "SOL");
    assert.strictEqual(sol.walletName, "Phantom");
    assert.ok(sol.estimatedTime.length > 0);
  });

  test("each chain has all required fields", () => {
    const requiredFields = ["id", "label", "currency", "walletName", "estimatedTime"];
    for (const chain of SUPPORTED_CHAINS) {
      for (const field of requiredFields) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(chain, field),
          `Chain ${chain.id} missing field: ${field}`
        );
      }
    }
  });

  test("chain ids are unique", () => {
    const ids = SUPPORTED_CHAINS.map((c: { id: string }) => c.id);
    const unique = new Set(ids);
    assert.strictEqual(unique.size, ids.length, "Duplicate chain IDs found");
  });
});

// ─── estimateBridgeFee — Ethereum ─────────────────────────────────────────────

describe("estimateBridgeFee — ethereum", () => {
  test("returns correct structure", () => {
    const result = estimateBridgeFee("ethereum", "100");
    assert.ok(typeof result.bridgeFee === "string");
    assert.ok(typeof result.bridgeFeeRatio === "number");
    assert.ok(typeof result.netAmount === "string");
    assert.ok(typeof result.estimatedTime === "string");
  });

  test("fee ratio is 0.3 % for ethereum", () => {
    const result = estimateBridgeFee("ethereum", "100");
    assert.strictEqual(result.bridgeFeeRatio, 0.003);
  });

  test("net amount is amount minus fee for ethereum", () => {
    const result = estimateBridgeFee("ethereum", "100");
    // 100 - 100 * 0.003 = 99.7
    assert.strictEqual(result.netAmount, "99.700000");
  });

  test("net amount is correct for fractional input", () => {
    const result = estimateBridgeFee("ethereum", "50.5");
    // 50.5 - 50.5 * 0.003 = 50.3485
    const expected = (50.5 - 50.5 * 0.003).toFixed(6);
    assert.strictEqual(result.netAmount, expected);
  });

  test("bridgeFee string contains ETH", () => {
    const result = estimateBridgeFee("ethereum", "100");
    assert.ok(result.bridgeFee.includes("ETH"), `expected ETH in: ${result.bridgeFee}`);
  });

  test("estimatedTime is non-empty string", () => {
    const result = estimateBridgeFee("ethereum", "100");
    assert.ok(result.estimatedTime.trim().length > 0);
  });

  test("handles large amount", () => {
    const result = estimateBridgeFee("ethereum", "1000000");
    const expected = (1_000_000 - 1_000_000 * 0.003).toFixed(6);
    assert.strictEqual(result.netAmount, expected);
  });

  test("handles zero amount — net is 0", () => {
    const result = estimateBridgeFee("ethereum", "0");
    assert.strictEqual(parseFloat(result.netAmount), 0);
  });

  test("handles empty string amount — net is 0", () => {
    const result = estimateBridgeFee("ethereum", "");
    assert.strictEqual(parseFloat(result.netAmount), 0);
  });

  test("net amount never goes negative", () => {
    const result = estimateBridgeFee("ethereum", "-50");
    assert.ok(parseFloat(result.netAmount) >= 0);
  });
});

// ─── estimateBridgeFee — Solana ───────────────────────────────────────────────

describe("estimateBridgeFee — solana", () => {
  test("fee ratio is 0.1 % for solana", () => {
    const result = estimateBridgeFee("solana", "100");
    assert.strictEqual(result.bridgeFeeRatio, 0.001);
  });

  test("net amount is amount minus fee for solana", () => {
    const result = estimateBridgeFee("solana", "100");
    // 100 - 100 * 0.001 = 99.9
    assert.strictEqual(result.netAmount, "99.900000");
  });

  test("bridgeFee string contains SOL", () => {
    const result = estimateBridgeFee("solana", "100");
    assert.ok(result.bridgeFee.includes("SOL"), `expected SOL in: ${result.bridgeFee}`);
  });

  test("solana fee is lower than ethereum fee for same amount", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    assert.ok(
      parseFloat(sol.netAmount) > parseFloat(eth.netAmount),
      `solana net ${sol.netAmount} should be higher than ethereum net ${eth.netAmount}`
    );
  });

  test("handles fractional input", () => {
    const result = estimateBridgeFee("solana", "200.25");
    const expected = (200.25 - 200.25 * 0.001).toFixed(6);
    assert.strictEqual(result.netAmount, expected);
  });

  test("estimatedTime is non-empty string", () => {
    const result = estimateBridgeFee("solana", "100");
    assert.ok(result.estimatedTime.trim().length > 0);
  });
});

// ─── estimateBridgeFee — cross-chain comparison ───────────────────────────────

describe("estimateBridgeFee — cross-chain", () => {
  test("both chains return matching structure shape", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    const keys = ["bridgeFee", "bridgeFeeRatio", "netAmount", "estimatedTime"];
    for (const key of keys) {
      assert.ok(key in eth, `ethereum result missing key: ${key}`);
      assert.ok(key in sol, `solana result missing key: ${key}`);
    }
  });

  test("estimatedTime differs between chains", () => {
    const eth = estimateBridgeFee("ethereum", "100");
    const sol = estimateBridgeFee("solana", "100");
    assert.notStrictEqual(
      eth.estimatedTime,
      sol.estimatedTime,
      "Estimated time should differ between chains"
    );
  });

  test("net amount is a valid decimal string", () => {
    for (const chain of ["ethereum", "solana"] as const) {
      const result = estimateBridgeFee(chain, "123.456");
      assert.ok(
        /^\d+\.\d+$/.test(result.netAmount),
        `Expected decimal string, got: ${result.netAmount}`
      );
    }
  });
});
