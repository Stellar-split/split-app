/**
 * Stellar network selection (testnet / mainnet / custom).
 *
 * The build-time env vars (`NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_RPC_URL`,
 * …) define the *default* network. In the browser a user can override it; the
 * choice is stored in localStorage and the page reloads so every module-level
 * constant (RPC URL, passphrase, contract client) is rebuilt for the new
 * network. Server code always uses the env default.
 */
import { StrKey } from "@stellar/stellar-sdk";

export type NetworkId = "testnet" | "mainnet" | "custom";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  /** StellarSplit contract on this network; empty when not deployed/configured. */
  contractId: string;
  usdcAddress: string;
  /** Base URL for transaction links, e.g. `${explorerTxBase}/${hash}`. */
  explorerTxBase: string;
}

export interface CustomNetworkInput {
  label?: string;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  contractId?: string;
  usdcAddress?: string;
}

export interface NetworkPreference {
  id: NetworkId;
  custom?: CustomNetworkInput;
}

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export const NETWORK_STORAGE_KEY = "stellarsplit_network";

/** Network the app was built for. */
export const DEFAULT_NETWORK_ID: Exclude<NetworkId, "custom"> =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

function envFor(id: "testnet" | "mainnet", specific: string | undefined, shared: string | undefined): string {
  // The un-prefixed env var belongs to the default network only, so a testnet
  // contract ID is never silently reused on mainnet.
  return specific ?? (id === DEFAULT_NETWORK_ID ? shared ?? "" : "");
}

export function getPresetNetwork(id: "testnet" | "mainnet"): NetworkConfig {
  if (id === "mainnet") {
    return {
      id,
      label: "Mainnet",
      passphrase: MAINNET_PASSPHRASE,
      rpcUrl: envFor(id, process.env.NEXT_PUBLIC_MAINNET_RPC_URL, process.env.NEXT_PUBLIC_RPC_URL) ||
        "https://soroban.stellar.org",
      horizonUrl: envFor(id, process.env.NEXT_PUBLIC_MAINNET_HORIZON_URL, process.env.NEXT_PUBLIC_HORIZON_URL) ||
        "https://horizon.stellar.org",
      contractId: envFor(id, process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ID, process.env.NEXT_PUBLIC_CONTRACT_ID),
      usdcAddress: envFor(id, process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS, process.env.NEXT_PUBLIC_USDC_ADDRESS),
      explorerTxBase: "https://stellar.expert/explorer/public/tx",
    };
  }
  return {
    id,
    label: "Testnet",
    passphrase: TESTNET_PASSPHRASE,
    rpcUrl: envFor(id, process.env.NEXT_PUBLIC_TESTNET_RPC_URL, process.env.NEXT_PUBLIC_RPC_URL) ||
      "https://soroban-testnet.stellar.org",
    horizonUrl: envFor(id, process.env.NEXT_PUBLIC_TESTNET_HORIZON_URL, process.env.NEXT_PUBLIC_HORIZON_URL) ||
      "https://horizon-testnet.stellar.org",
    contractId: envFor(id, process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ID, process.env.NEXT_PUBLIC_CONTRACT_ID),
    usdcAddress: envFor(id, process.env.NEXT_PUBLIC_TESTNET_USDC_ADDRESS, process.env.NEXT_PUBLIC_USDC_ADDRESS),
    explorerTxBase: "https://stellar.expert/explorer/testnet/tx",
  };
}

export function buildCustomNetwork(input: CustomNetworkInput): NetworkConfig {
  return {
    id: "custom",
    label: input.label?.trim() || "Custom",
    passphrase: input.passphrase.trim(),
    rpcUrl: input.rpcUrl.trim(),
    horizonUrl: input.horizonUrl.trim(),
    contractId: input.contractId?.trim() ?? "",
    usdcAddress: input.usdcAddress?.trim() ?? "",
    explorerTxBase:
      input.passphrase.trim() === MAINNET_PASSPHRASE
        ? "https://stellar.expert/explorer/public/tx"
        : "https://stellar.expert/explorer/testnet/tx",
  };
}

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // Plain http is only acceptable for a node running on this machine.
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Field-level problems with a custom network, empty when it is usable. */
export function validateCustomNetwork(input: CustomNetworkInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isAllowedUrl(input.rpcUrl.trim())) {
    errors.rpcUrl = "Enter an https:// RPC URL (http:// is only allowed for localhost)";
  }
  if (!isAllowedUrl(input.horizonUrl.trim())) {
    errors.horizonUrl = "Enter an https:// Horizon URL (http:// is only allowed for localhost)";
  }
  if (!input.passphrase.trim()) {
    errors.passphrase = "Network passphrase is required";
  }
  if (input.contractId?.trim() && !StrKey.isValidContract(input.contractId.trim())) {
    errors.contractId = "Contract ID must be a valid contract address starting with C";
  }
  if (input.usdcAddress?.trim() && !StrKey.isValidContract(input.usdcAddress.trim())) {
    errors.usdcAddress = "USDC address must be a valid contract address starting with C";
  }
  return errors;
}

export function resolveNetwork(pref: NetworkPreference | null): NetworkConfig {
  if (pref?.id === "custom" && pref.custom && Object.keys(validateCustomNetwork(pref.custom)).length === 0) {
    return buildCustomNetwork(pref.custom);
  }
  if (pref?.id === "testnet" || pref?.id === "mainnet") return getPresetNetwork(pref.id);
  return getPresetNetwork(DEFAULT_NETWORK_ID);
}

export function readNetworkPreference(): NetworkPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NETWORK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && ["testnet", "mainnet", "custom"].includes(parsed.id)) {
      return parsed as NetworkPreference;
    }
  } catch {
    // Corrupt or blocked storage — fall back to the default network.
  }
  return null;
}

export function writeNetworkPreference(pref: NetworkPreference | null): void {
  if (typeof window === "undefined") return;
  try {
    if (pref) window.localStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(pref));
    else window.localStorage.removeItem(NETWORK_STORAGE_KEY);
  } catch {
    // Storage unavailable — the choice just won't survive a reload.
  }
}

/**
 * The network the app should talk to right now: the user's saved choice in
 * the browser, otherwise the build default. Always the default on the server.
 */
export function getActiveNetwork(): NetworkConfig {
  return resolveNetwork(readNetworkPreference());
}

export function explorerTxUrl(hash: string, network: NetworkConfig = getActiveNetwork()): string {
  return `${network.explorerTxBase}/${hash}`;
}

export function explorerAccountUrl(address: string, network: NetworkConfig = getActiveNetwork()): string {
  return `${network.explorerTxBase.replace(/\/tx$/, "/account")}/${address}`;
}

/**
 * Ask an RPC endpoint which network it serves and compare it with the
 * expected passphrase, so a custom network can't silently point at the wrong
 * chain.
 */
export async function checkRpcNetwork(
  rpcUrl: string,
  expectedPassphrase: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getNetwork" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `RPC responded with HTTP ${res.status}` };
    const body = await res.json();
    const passphrase: unknown = body?.result?.passphrase;
    if (typeof passphrase !== "string") return { ok: false, error: "RPC did not report a network passphrase" };
    if (passphrase !== expectedPassphrase.trim()) {
      return { ok: false, error: `RPC is on a different network: "${passphrase}"` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not reach RPC: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Human-readable name for a passphrase, used when comparing with the wallet's network. */
export function describePassphrase(passphrase: string): string {
  if (passphrase === MAINNET_PASSPHRASE) return "Mainnet";
  if (passphrase === TESTNET_PASSPHRASE) return "Testnet";
  return "a custom network";
}
