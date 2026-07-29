/**
 * Lazy-initialised StellarSplitClient.
 * The client is only constructed on first use, not at module load time.
 * This prevents build-time errors when env vars are placeholders.
 */

import { StellarSplitClient, formatAmount } from "@stellar-split/sdk";
import { NETWORK_PASSPHRASE } from "./freighter";

let _client: StellarSplitClient | null = null;

export const MEMO_MAX_BYTES = 28;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
export const NORMAL_FEE_THRESHOLD = 100;

export const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

export const MAX_RECIPIENTS = 10;

export function getSplitClient(): StellarSplitClient {
  if (!_client) {
    const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
    _client = new StellarSplitClient({ rpcUrl: RPC_URL, networkPassphrase: NETWORK_PASSPHRASE, contractId });
  }
  return _client;
}

// Convenience re-export for components that use it directly
export const splitClient = new Proxy({} as StellarSplitClient, {
  get(_target, prop) {
    return (getSplitClient() as never)[prop as keyof StellarSplitClient];
  },
});

async function buildAssetFromPathRecord(record: {
  asset_type: string;
  asset_code: string | null;
  asset_issuer: string | null;
}) {
  const { Asset } = await import("@stellar/stellar-sdk");
  if (record.asset_type === "native") {
    return Asset.native();
  }
  if (!record.asset_code || !record.asset_issuer) {
    throw new Error("Invalid path asset record.");
  }
  return new Asset(record.asset_code, record.asset_issuer);
}

export async function quoteXlmToUsdc(
  walletAddress: string,
  usdcAmount: bigint
): Promise<{
  sourceAmount: string;
  destinationAmount: string;
  path: Array<{ asset_code: string | null; asset_issuer: string | null; asset_type: string }>;
}> {
  if (!USDC_CONTRACT_ID) {
    throw new Error("USDC token contract is not configured.");
  }

  const { Asset, Horizon } = await import("@stellar/stellar-sdk");
  const destinationAmount = formatAmount(usdcAmount);
  const usdcAsset = new Asset("USDC", USDC_CONTRACT_ID);
  const server = new Horizon.Server(HORIZON_URL);
  const result = await server.strictReceivePaths(walletAddress, usdcAsset, destinationAmount).call();
  const path = result.records?.[0];
  if (!path) {
    throw new Error("No XLM->USDC path found.");
  }
  return {
    sourceAmount: path.source_amount,
    destinationAmount: path.destination_amount,
    path: path.path,
  };
}

export async function convertXlmToUsdc(
  walletAddress: string,
  usdcAmount: bigint
): Promise<{ txHash: string; sourceAmount: string }> {
  if (!USDC_CONTRACT_ID) {
    throw new Error("USDC token contract is not configured.");
  }

  const { Asset, Horizon, Operation, TransactionBuilder, BASE_FEE } = await import("@stellar/stellar-sdk");
  const { signWithFreighter } = await import("./freighter");

  const destinationAmount = formatAmount(usdcAmount);
  const usdcAsset = new Asset("USDC", USDC_CONTRACT_ID);
  const server = new Horizon.Server(HORIZON_URL);

  const pathResult = await server.strictReceivePaths(walletAddress, usdcAsset, destinationAmount).call();
  const bestPath = pathResult.records?.[0];
  if (!bestPath) {
    throw new Error("No XLM->USDC path found.");
  }

  const sendAsset = await buildAssetFromPathRecord({
    asset_type: bestPath.source_asset_type,
    asset_code: bestPath.source_asset_code,
    asset_issuer: bestPath.source_asset_issuer,
  });
  const path = await Promise.all(
    bestPath.path.map((asset) => buildAssetFromPathRecord(asset))
  );
  const sourceAccount = await server.loadAccount(walletAddress);

  const operation = Operation.pathPaymentStrictReceive({
    sendAsset,
    sendMax: bestPath.source_amount,
    destination: walletAddress,
    destAsset: usdcAsset,
    destAmount: destinationAmount,
    path,
  });

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const signedXdr = await signWithFreighter(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const submitResult = await server.submitTransaction(signedTx);

  return { txHash: submitResult.hash, sourceAmount: bestPath.source_amount };
}

/**
 * Pay toward an invoice with automatic nonce management.
 * Fetches the current nonce for the payer, increments it, and includes it
 * in the pay transaction to prevent replay attacks.
 */
export async function payWithNonce(params: {
  payer: string;
  invoiceId: string;
  amount: bigint;
}): Promise<{ txHash: string }> {
  const { getPayerNonce } = await import("./paymentNonce");
  const client = getSplitClient();
  const nonce = await getPayerNonce(params.payer);
  return (client as any).pay({
    ...params,
    nonce: nonce + 1n,
  });
}

export async function payMilestone(params: {
  payer: string;
  invoiceId: string;
  amount: bigint;
  milestoneId: string;
}): Promise<{ txHash: string }> {
  const client = getSplitClient();
  const { TransactionBuilder, BASE_FEE, Memo, nativeToScVal, rpc } = await import("@stellar/stellar-sdk");
  const { signWithFreighter } = await import("./freighter");

  // The published @stellar-split/sdk keeps `contract`, `server` and `config`
  // as private fields with no public accessors. Milestone payments need a
  // custom memo, which the SDK's typed API does not support, so we reach the
  // underlying internals here (object properties — still accessible at
  // runtime despite the `private` TypeScript modifier).
  const internals = client as unknown as {
    contract: { call: (...args: any[]) => any };
    server: any;
    config: { networkPassphrase: string };
  };

  const memoText = `INV:${params.invoiceId}:M:${params.milestoneId}`.slice(0, 28);

  const operation = internals.contract.call(
    "pay",
    nativeToScVal(params.payer, { type: "address" }),
    nativeToScVal(BigInt(params.invoiceId), { type: "u64" }),
    nativeToScVal(params.amount, { type: "i128" })
  );

  const sourceAccount = await internals.server.getAccount(params.payer);
  const networkPassphrase = internals.config.networkPassphrase;

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .addMemo(Memo.text(memoText))
    .setTimeout(30)
    .build();

  const simResult = await internals.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await signWithFreighter(preparedTx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sendResult = await internals.server.sendTransaction(signedTx);

  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let getResult = await internals.server.getTransaction(sendResult.hash);
  let attempts = 0;
  while (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await internals.server.getTransaction(sendResult.hash);
    attempts++;
  }

  if (getResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction not confirmed: ${getResult.status}`);
  }

  return { txHash: sendResult.hash };
}

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
  tokenContractId = USDC_CONTRACT_ID
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

  const server = new rpc.Server(RPC_URL, { allowHttp: true });

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

/**
 * Resolve a federation address (e.g., alice*example.com) to a Stellar address
 */
export async function resolveFederationAddress(federationAddress: string): Promise<string | null> {
  try {
    const { Federation } = await import("@stellar/stellar-sdk");
    const result = await Federation.Server.resolve(federationAddress);
    return result.account_id;
  } catch {
    return null;
  }
}

/**
 * Validate a Stellar address and check if it's funded and requires memo
 */
export async function validateFederationAddress(address: string): Promise<{
  isFunded: boolean;
  requiresMemo: boolean;
}> {
  try {
    const { Horizon } = await import("@stellar/stellar-sdk");
    const server = new Horizon.Server(HORIZON_URL);

    const account = await server.loadAccount(address);
    const balances = account.balances;

    const isFunded = balances.length > 0;
    // Horizon's standard account flags don't expose a memo-required flag in
    // current SDK typings — some Horizon deployments include a non-standard
    // `require_auth_memoized_flag`, so read it defensively.
    const flags = account.flags as
      | (typeof account.flags & { require_auth_memoized_flag?: boolean })
      | undefined;
    const requiresMemo = flags?.require_auth_memoized_flag || false;

    return { isFunded, requiresMemo };
  } catch (error) {
    return { isFunded: false, requiresMemo: false };
  }
}

export function validateRecipientAmountSum(amounts: number[], totalAmount: number): boolean {
  const STROOP_SCALE = 1e7;
  const totalStroops = Math.round(totalAmount * STROOP_SCALE);
  const sumStroops = amounts.reduce((s, a) => s + Math.round(a * STROOP_SCALE), 0);
  return totalStroops === sumStroops;
}
