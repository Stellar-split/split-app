import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "./freighter";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

const BLINDING_KEY_PREFIX = "stellarsplit_blinding";
const REVEALED_KEY_PREFIX = "stellarsplit_revealed";
const AMOUNT_KEY_PREFIX = "stellarsplit_committed_amount";

function blindingStorageKey(invoiceId: string, payer: string): string {
  return `${BLINDING_KEY_PREFIX}_${invoiceId}_${payer}`;
}

function revealedStorageKey(invoiceId: string, payer: string): string {
  return `${REVEALED_KEY_PREFIX}_${invoiceId}_${payer}`;
}

function amountStorageKey(invoiceId: string, payer: string): string {
  return `${AMOUNT_KEY_PREFIX}_${invoiceId}_${payer}`;
}

export function generateBlindingFactor(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPedersenCommitment(
  amount: bigint,
  blindingFactor: string
): Promise<string> {
  const data = `${amount.toString()}:${blindingFactor}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function saveBlindingFactor(
  invoiceId: string,
  payer: string,
  factor: string
): void {
  try {
    localStorage.setItem(blindingStorageKey(invoiceId, payer), factor);
  } catch {}
}

export function loadBlindingFactor(
  invoiceId: string,
  payer: string
): string | null {
  try {
    return localStorage.getItem(blindingStorageKey(invoiceId, payer));
  } catch {
    return null;
  }
}

export function hasBlindingFactor(
  invoiceId: string,
  payer: string
): boolean {
  return loadBlindingFactor(invoiceId, payer) !== null;
}

export function markRevealed(invoiceId: string, payer: string): void {
  try {
    localStorage.setItem(revealedStorageKey(invoiceId, payer), "true");
  } catch {}
}

export function saveCommittedAmount(
  invoiceId: string,
  payer: string,
  amount: string
): void {
  try {
    localStorage.setItem(amountStorageKey(invoiceId, payer), amount);
  } catch {}
}

export function loadCommittedAmount(
  invoiceId: string,
  payer: string
): string | null {
  try {
    return localStorage.getItem(amountStorageKey(invoiceId, payer));
  } catch {
    return null;
  }
}

export function isRevealed(invoiceId: string, payer: string): boolean {
  try {
    return localStorage.getItem(revealedStorageKey(invoiceId, payer)) === "true";
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return Uint8Array.from(bytes);
}

async function signAndSubmit(
  server: SorobanRpc.Server,
  sourceAddress: string,
  operation: xdr.Operation
): Promise<{ txHash: string }> {
  const { signWithFreighter } = await import("./freighter");
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await signWithFreighter(preparedTx.toXDR());
  const sendResult = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  if (sendResult.status === "ERROR") {
    throw new Error(
      `Transaction failed: ${JSON.stringify(sendResult.errorResult)}`
    );
  }
  const txHash = sendResult.hash;
  let getResult = await server.getTransaction(txHash);
  let attempts = 0;
  while (
    getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
    attempts < 20
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(txHash);
    attempts++;
  }
  if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction not confirmed: ${getResult.status}`);
  }
  return { txHash };
}

export async function submitCommitment(params: {
  payer: string;
  invoiceId: string;
  commitment: string;
}): Promise<{ txHash: string }> {
  const commitmentBytes = hexToBytes(params.commitment);
  const server = new SorobanRpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call(
    "create_commitment",
    nativeToScVal(params.payer, { type: "address" }),
    nativeToScVal(BigInt(params.invoiceId), { type: "u64" }),
    xdr.ScVal.scvBytes(commitmentBytes as any)
  );
  return signAndSubmit(server, params.payer, operation);
}

export async function revealPayment(params: {
  payer: string;
  invoiceId: string;
  amount: bigint;
  blindingFactor: string;
}): Promise<{ txHash: string }> {
  const blindingBytes = hexToBytes(params.blindingFactor);
  const server = new SorobanRpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call(
    "reveal_payment",
    nativeToScVal(params.payer, { type: "address" }),
    nativeToScVal(BigInt(params.invoiceId), { type: "u64" }),
    nativeToScVal(params.amount, { type: "i128" }),
    xdr.ScVal.scvBytes(blindingBytes as any)
  );
  return signAndSubmit(server, params.payer, operation);
}
