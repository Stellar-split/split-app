/**
 * App-level Stellar / Soroban configuration.
 * Mirrors env vars used by `src/lib/stellar.ts` so settings pages can import a single module.
 */

export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (STELLAR_NETWORK === "mainnet"
    ? "https://soroban.stellar.org"
    : "https://soroban-testnet.stellar.org");

/** StellarSplit contract ID used for on-chain calls and event filtering. */
export const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export const config = {
  network: STELLAR_NETWORK,
  rpcUrl: RPC_URL,
  contractId,
} as const;

export default config;
