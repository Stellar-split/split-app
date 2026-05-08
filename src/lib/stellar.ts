/**
 * Initialises the StellarSplitClient singleton from environment variables.
 * Import `splitClient` wherever you need to call the contract.
 */

import { StellarSplitClient } from "@stellar-split/sdk";
import { NETWORK_PASSPHRASE } from "./freighter";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL!;
const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID!;

if (!rpcUrl || !contractId) {
  throw new Error(
    "Missing NEXT_PUBLIC_RPC_URL or NEXT_PUBLIC_CONTRACT_ID environment variables."
  );
}

export const splitClient = new StellarSplitClient({
  rpcUrl,
  networkPassphrase: NETWORK_PASSPHRASE,
  contractId,
});
