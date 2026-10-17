import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import {
  DEFAULT_NETWORK_ID,
  MAINNET_PASSPHRASE,
  NETWORK_STORAGE_KEY,
  TESTNET_PASSPHRASE,
  buildCustomNetwork,
  checkRpcNetwork,
  explorerAccountUrl,
  explorerTxUrl,
  getActiveNetwork,
  getPresetNetwork,
  readNetworkPreference,
  resolveNetwork,
  validateCustomNetwork,
  writeNetworkPreference,
  type CustomNetworkInput,
} from "@/lib/networks";

const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7));

const goodCustom: CustomNetworkInput = {
  label: "Local",
  passphrase: "Standalone Network ; February 2017",
  rpcUrl: "http://localhost:8000/soroban/rpc",
  horizonUrl: "http://localhost:8000",
  contractId: CONTRACT,
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("network selection (#889)", () => {
  beforeEach(() => localStorage.clear());

  it("presets use the right passphrase and explorer per network", () => {
    const testnet = getPresetNetwork("testnet");
    const mainnet = getPresetNetwork("mainnet");
    expect(testnet.passphrase).toBe(TESTNET_PASSPHRASE);
    expect(mainnet.passphrase).toBe(MAINNET_PASSPHRASE);
    expect(testnet.explorerTxBase).toContain("/testnet/");
    expect(mainnet.explorerTxBase).toContain("/public/");
    expect(testnet.horizonUrl).not.toBe(mainnet.horizonUrl);
  });

  it("uses the build default when nothing is stored", () => {
    expect(readNetworkPreference()).toBeNull();
    expect(getActiveNetwork().id).toBe(DEFAULT_NETWORK_ID);
  });

  it("remembers the chosen network across reads", () => {
    writeNetworkPreference({ id: "mainnet" });
    expect(readNetworkPreference()).toEqual({ id: "mainnet" });
    expect(getActiveNetwork().passphrase).toBe(MAINNET_PASSPHRASE);

    writeNetworkPreference(null);
    expect(localStorage.getItem(NETWORK_STORAGE_KEY)).toBeNull();
  });

  it("ignores corrupt or unknown stored values", () => {
    localStorage.setItem(NETWORK_STORAGE_KEY, "{not json");
    expect(getActiveNetwork().id).toBe(DEFAULT_NETWORK_ID);
    localStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify({ id: "futurenet" }));
    expect(getActiveNetwork().id).toBe(DEFAULT_NETWORK_ID);
  });

  it("resolves a valid custom network and falls back when it is invalid", () => {
    const custom = resolveNetwork({ id: "custom", custom: goodCustom });
    expect(custom.id).toBe("custom");
    expect(custom.rpcUrl).toBe(goodCustom.rpcUrl);
    expect(custom.contractId).toBe(CONTRACT);

    const broken = resolveNetwork({ id: "custom", custom: { ...goodCustom, rpcUrl: "not a url" } });
    expect(broken.id).toBe(DEFAULT_NETWORK_ID);
  });

  it("never reuses the default network's contract ID on the other network", () => {
    const other = DEFAULT_NETWORK_ID === "testnet" ? "mainnet" : "testnet";
    const shared = process.env.NEXT_PUBLIC_CONTRACT_ID;
    if (shared) expect(getPresetNetwork(other).contractId).not.toBe(shared);
  });

  describe("validateCustomNetwork", () => {
    it("accepts a well-formed network", () => {
      expect(validateCustomNetwork(goodCustom)).toEqual({});
    });

    it("rejects plain http for remote hosts but allows localhost", () => {
      const errors = validateCustomNetwork({ ...goodCustom, rpcUrl: "http://rpc.example.org" });
      expect(errors.rpcUrl).toBeDefined();
      expect(validateCustomNetwork({ ...goodCustom, rpcUrl: "http://127.0.0.1:8000" }).rpcUrl).toBeUndefined();
    });

    it("requires a passphrase and valid contract addresses", () => {
      const errors = validateCustomNetwork({ ...goodCustom, passphrase: " ", contractId: "Cbad", usdcAddress: "nope" });
      expect(errors.passphrase).toBeDefined();
      expect(errors.contractId).toBeDefined();
      expect(errors.usdcAddress).toBeDefined();
    });
  });

  describe("checkRpcNetwork", () => {
    it("passes when the RPC reports the expected passphrase", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: { passphrase: goodCustom.passphrase } }));
      await expect(checkRpcNetwork(goodCustom.rpcUrl, goodCustom.passphrase, fetchImpl)).resolves.toEqual({ ok: true });
      const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
      expect(body.method).toBe("getNetwork");
    });

    it("fails when the RPC is on a different network", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: { passphrase: TESTNET_PASSPHRASE } }));
      const result = await checkRpcNetwork(goodCustom.rpcUrl, MAINNET_PASSPHRASE, fetchImpl);
      expect(result.ok).toBe(false);
    });

    it("fails on HTTP errors and unreachable hosts", async () => {
      expect((await checkRpcNetwork("https://x", "p", vi.fn().mockResolvedValue(jsonResponse({}, 503)))).ok).toBe(false);
      expect((await checkRpcNetwork("https://x", "p", vi.fn().mockRejectedValue(new Error("boom"))))).toEqual({
        ok: false,
        error: "Could not reach RPC: boom",
      });
    });
  });

  it("builds explorer links for the given network", () => {
    const mainnet = getPresetNetwork("mainnet");
    expect(explorerTxUrl("abc", mainnet)).toBe("https://stellar.expert/explorer/public/tx/abc");
    expect(explorerAccountUrl("GABC", mainnet)).toBe("https://stellar.expert/explorer/public/account/GABC");
    expect(buildCustomNetwork({ ...goodCustom, passphrase: MAINNET_PASSPHRASE }).explorerTxBase).toContain("/public/");
  });
});
