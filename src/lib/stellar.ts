/**
 * Lazy-initialised StellarSplitClient.
 * The client is only constructed on first use, not at module load time.
 * This prevents build-time errors when env vars are placeholders.
 */

import { StellarSplitClient } from "@stellar-split/sdk";
import { NETWORK_PASSPHRASE } from "./freighter";

let _client: StellarSplitClient | null = null;

export function getSplitClient(): StellarSplitClient {
  if (!_client) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
    _client = new StellarSplitClient({ rpcUrl, networkPassphrase: NETWORK_PASSPHRASE, contractId });
  }
  return _client;
}

// Convenience re-export for components that use it directly
export const splitClient = new Proxy({} as StellarSplitClient, {
  get(_target, prop) {
    return (getSplitClient() as never)[prop as keyof StellarSplitClient];
  },
});
