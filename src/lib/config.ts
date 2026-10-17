/**
 * App-level Stellar / Soroban configuration.
 * Resolved from the active network (see `src/lib/networks.ts`) so settings
 * pages can import a single module.
 */
import { getActiveNetwork } from "./networks";

const active = getActiveNetwork();

/** "custom" networks are reported by their passphrase family for callers that only know testnet/mainnet. */
export const STELLAR_NETWORK: "mainnet" | "testnet" =
  active.id === "mainnet" || (active.id === "custom" && active.explorerTxBase.includes("/public/"))
    ? "mainnet"
    : "testnet";

export const RPC_URL = active.rpcUrl;

/** StellarSplit contract ID used for on-chain calls and event filtering. */
export const contractId = active.contractId;

export const config = {
  network: STELLAR_NETWORK,
  networkId: active.id,
  rpcUrl: RPC_URL,
  contractId,
} as const;

export default config;
