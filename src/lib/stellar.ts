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

/**
 * Fetch the USDC token balance for a given address.
 *
 * Calls the SEP-41 `balance(address)` function on the token contract
 * via a read-only simulation (no transaction needed).
 *
 * @returns Balance in stroops (bigint), or throws on failure.
 */
export async function fetchUsdcBalance(
  walletAddress: string,
  tokenContractId: string
): Promise<bigint> {
  const {
    Contract,
    Address,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    scValToBigInt,
    rpc,
  } = await import("@stellar/stellar-sdk");

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const server = new rpc.Server(rpcUrl, { allowHttp: true });

  const networkPassphrase =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
      ? Networks.PUBLIC
      : Networks.TESTNET;

  const contract = new Contract(tokenContractId);
  const accountArg = Address.fromString(walletAddress).toScVal();
  const operation = contract.call("balance", accountArg);

  const sourceAccount = await server.getAccount(walletAddress);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(result)) {
    throw new Error(result.error);
  }

  const successResult = result as {
    result?: { retval: import("@stellar/stellar-sdk").xdr.ScVal };
  };
  const retval = successResult.result?.retval;
  if (!retval) return 0n;

  return scValToBigInt(retval);
}
