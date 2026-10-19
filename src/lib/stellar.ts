/**
 * Lazy-initialised StellarSplitClient.
 * The client is only constructed on first use, not at module load time.
 * This prevents build-time errors when env vars are placeholders.
 */

import { StellarSplitClient, formatAmount } from "@stellar-split/sdk";
import { NETWORK_PASSPHRASE } from "./freighter";
import { getActiveNetwork } from "./networks";

let _client: StellarSplitClient | null = null;

const activeNetwork = getActiveNetwork();

export const MEMO_MAX_BYTES = 28;
export const RPC_URL = activeNetwork.rpcUrl;
export const HORIZON_URL = activeNetwork.horizonUrl;
export const NORMAL_FEE_THRESHOLD = 100;

export const USDC_CONTRACT_ID = activeNetwork.usdcAddress;

export const MAX_RECIPIENTS = 10;

export function getSplitClient(): StellarSplitClient {
  if (!_client) {
    _client = new StellarSplitClient({
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      contractId: activeNetwork.contractId,
    });
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

  const networkPassphrase = NETWORK_PASSPHRASE;

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
 * Validate a Stellar account address using StrKey.
 * Returns true only for well-formed, checksum-valid ed25519 public keys.
 */
export function validateStellarAddress(address: string): boolean {
  if (typeof address !== "string" || address.length === 0) return false;
  try {
    // StrKey is a synchronous part of the SDK; require it lazily to keep the
    // module load-time footprint small.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StrKey } = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

export const FEDERATION_SERVER_URL =
  process.env.NEXT_PUBLIC_FEDERATION_SERVER_URL ?? "https://federation.stellar.org";
export const FEDERATION_TIMEOUT_MS = 8000;

/**
 * Resolve a federation address (e.g., alice*example.com) to a Stellar address.
 *
 * Uses the configured federation server URL and a bounded timeout so a slow or
 * unreachable server cannot hang the UI. Returns null on any failure.
 */
export async function resolveFederationAddress(
  federationAddress: string,
  options: { serverUrl?: string; timeoutMs?: number } = {}
): Promise<string | null> {
  if (typeof federationAddress !== "string" || !federationAddress.includes("*")) {
    return null;
  }

  const serverUrl = options.serverUrl ?? FEDERATION_SERVER_URL;
  const timeoutMs = options.timeoutMs ?? FEDERATION_TIMEOUT_MS;

  try {
    const { Federation } = await import("@stellar/stellar-sdk");
    const server = new Federation.Server(serverUrl);
    const result = await Promise.race([
      server.resolve(federationAddress),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Federation resolution timed out.")), timeoutMs)
      ),
    ]);
    return result.account_id ?? null;
  } catch {
    return null;
  }
}

export interface AccountBalance {
  /** Asset code, or "XLM" for the native asset. */
  assetCode: string;
  /** Issuer account for issued assets; null for native XLM. */
  assetIssuer: string | null;
  /** Raw balance in stroops. */
  raw: bigint;
  /** Human-readable balance (7 decimal places). */
  formatted: string;
  /** Whether this is the native XLM asset. */
  isNative: boolean;
}

/**
 * Fetch all balances (native XLM plus issued assets) for an account from Horizon.
 *
 * Throws if the account cannot be loaded (e.g. unfunded or invalid address).
 */
export async function fetchAccountBalances(walletAddress: string): Promise<AccountBalance[]> {
  const { Horizon } = await import("@stellar/stellar-sdk");
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(walletAddress);

  return account.balances.map((balance) => {
    const isNative = balance.asset_type === "native";
    const assetCode = isNative ? "XLM" : (balance as { asset_code?: string }).asset_code ?? "";
    const assetIssuer = isNative
      ? null
      : (balance as { asset_issuer?: string }).asset_issuer ?? null;
    const raw = BigInt(
      Math.round(parseFloat(balance.balance) * 1e7)
    );
    return {
      assetCode,
      assetIssuer,
      raw,
      formatted: formatAmount(raw),
      isNative,
    };
  });
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

/**
 * Release funds for a milestone, but only once every condition attached to
 * that milestone has been satisfied and approved.
 *
 * The milestone release gate (`canReleaseMilestone`) is evaluated first; if
 * any condition is unmet this throws before any transaction is built, so no
 * funds can move. On success the existing contract `release` path is invoked
 * and a notification is emitted.
 */
export async function releaseMilestoneFunds(params: {
  invoiceId: string;
  milestoneId: string;
  payer: string;
}): Promise<{ txHash: string }> {
  const { canReleaseMilestone } = await import("./milestones");
  const { notifyMilestoneReleased } = await import("./notifications");

  const gate = await canReleaseMilestone({
    invoiceId: params.invoiceId,
    milestoneId: params.milestoneId,
  });

  if (!gate.canRelease) {
    const unmet = gate.unmetConditions?.length
      ? ` Unmet conditions: ${gate.unmetConditions.join(", ")}.`
      : "";
    throw new Error(`Milestone conditions are not satisfied.${unmet}`);
  }

  const client = getSplitClient();
  const { TransactionBuilder, BASE_FEE, Memo, nativeToScVal, rpc } = await import("@stellar/stellar-sdk");
  const { signWithFreighter } = await import("./freighter");

  // Same rationale as `payMilestone`: the published SDK does not expose a
  // typed milestone-release call with a custom memo, so reach the underlying
  // internals at runtime.
  const internals = client as unknown as {
    contract: { call: (...args: any[]) => any };
    server: any;
    config: { networkPassphrase: string };
  };

  const memoText = `INV:${params.invoiceId}:REL:${params.milestoneId}`.slice(0, MEMO_MAX_BYTES);

  const operation = internals.contract.call(
    "release_milestone",
    nativeToScVal(BigInt(params.invoiceId), { type: "u64" }),
    nativeToScVal(params.milestoneId, { type: "string" })
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

  await notifyMilestoneReleased({
    invoiceId: params.invoiceId,
    milestoneId: params.milestoneId,
    txHash: sendResult.hash,
  });

  return { txHash: sendResult.hash };
}

export type DisputeOutcome = "release" | "refund" | "split";

/**
 * Enforce a resolved dispute by invoking the matching contract method.
 *
 * - `release` pays the recipient the disputed funds.
 * - `refund` returns the disputed funds to the payer.
 * - `split` divides the disputed funds according to the resolution's split
 *   ratio (defaults to an even split when none is supplied).
 *
 * A notification is emitted on success so both parties are informed.
 */
export async function enforceDisputeResolution(params: {
  invoiceId: string;
  outcome: DisputeOutcome;
  payer: string;
  splitRatio?: number;
}): Promise<{ txHash: string }> {
  const { notifyDisputeResolved } = await import("./notifications");

  const methodByOutcome: Record<DisputeOutcome, string> = {
    release: "release_disputed_funds",
    refund: "refund_disputed_funds",
    split: "split_disputed_funds",
  };

  const method = methodByOutcome[params.outcome];
  if (!method) {
    throw new Error(`Unsupported dispute outcome: ${params.outcome}`);
  }

  const client = getSplitClient();
  const { TransactionBuilder, BASE_FEE, Memo, nativeToScVal, rpc } = await import("@stellar/stellar-sdk");
  const { signWithFreighter } = await import("./freighter");

  const internals = client as unknown as {
    contract: { call: (...args: any[]) => any };
    server: any;
    config: { networkPassphrase: string };
  };

  const memoText = `INV:${params.invoiceId}:DSP:${params.outcome}`.slice(0, MEMO_MAX_BYTES);

  const callArgs: any[] = [nativeToScVal(BigInt(params.invoiceId), { type: "u64" })];
  if (params.outcome === "split") {
    const ratio = params.splitRatio ?? 0.5;
    if (ratio < 0 || ratio > 1) {
      throw new Error("splitRatio must be between 0 and 1.");
    }
    callArgs.push(nativeToScVal(Math.round(ratio * 10_000), { type: "u32" }));
  }

  const operation = internals.contract.call(method, ...callArgs);

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

  await notifyDisputeResolved({
    invoiceId: params.invoiceId,
    outcome: params.outcome,
    txHash: sendResult.hash,
  });

  return { txHash: sendResult.hash };
}
