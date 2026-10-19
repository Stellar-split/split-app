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

/**
 * WalletConnect v2 configuration (#884).
 *
 * The project ID is required for the WalletConnect Cloud relay; when it is
 * missing the WalletConnect service should surface a clear error rather than
 * attempting to connect.
 */
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const WALLETCONNECT_RELAY_URL =
  process.env.NEXT_PUBLIC_WALLETCONNECT_RELAY_URL ?? "wss://relay.walletconnect.com";

/** CAIP-2 chain identifiers for the Stellar networks we support. */
export const STELLAR_CHAIN_IDS = {
  mainnet: "stellar:pubnet",
  testnet: "stellar:testnet",
} as const;

export type StellarChainId = (typeof STELLAR_CHAIN_IDS)[keyof typeof STELLAR_CHAIN_IDS];

/** Chain IDs advertised to mobile wallets during session proposal. */
export const SUPPORTED_CHAIN_IDS: readonly StellarChainId[] = [
  STELLAR_CHAIN_IDS.mainnet,
  STELLAR_CHAIN_IDS.testnet,
];

/** The chain ID matching the currently configured network. */
export const ACTIVE_CHAIN_ID: StellarChainId = STELLAR_CHAIN_IDS[STELLAR_NETWORK];

/** Session lifetime before the pairing is considered stale (ms). */
export const WALLETCONNECT_SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** Timeout for a single signing request round-trip (ms). */
export const WALLETCONNECT_SIGN_TIMEOUT_MS = 60 * 1000;

/** Retry policy for transient relay / signing failures. */
export const WALLETCONNECT_RETRY_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffFactor: 2,
} as const;

export const walletConnectConfig = {
  projectId: WALLETCONNECT_PROJECT_ID,
  relayUrl: WALLETCONNECT_RELAY_URL,
  metadata: {
    name: "StellarSplit",
    description: "Split and settle payments on Stellar",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://stellarsplit.app",
    icons: ["https://stellarsplit.app/icon.png"],
  },
  network: STELLAR_NETWORK,
  chainIds: SUPPORTED_CHAIN_IDS,
  activeChainId: ACTIVE_CHAIN_ID,
  sessionTimeoutMs: WALLETCONNECT_SESSION_TIMEOUT_MS,
  signTimeoutMs: WALLETCONNECT_SIGN_TIMEOUT_MS,
  retry: WALLETCONNECT_RETRY_POLICY,
} as const;

export const config = {
  network: STELLAR_NETWORK,
  networkId: active.id,
  rpcUrl: RPC_URL,
  contractId,
  walletConnect: walletConnectConfig,
} as const;

export default config;