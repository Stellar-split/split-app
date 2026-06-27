import { NETWORK_PASSPHRASE } from "./freighter";
import { getSplitClient } from "./stellar";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export interface PendingAdminInfo {
  newAdmin: string;
  proposedAt: number;
}

export async function proposeAdmin(admin: string, newAdmin: string): Promise<{ txHash: string }> {
  const client = getSplitClient();
  return (client as any).proposeAdmin({ admin, newAdmin });
}

export async function confirmAdmin(admin: string): Promise<{ txHash: string }> {
  const client = getSplitClient();
  return (client as any).confirmAdmin({ admin });
}

export async function getPendingAdmin(): Promise<PendingAdminInfo | null> {
  const { Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative, rpc } = await import("@stellar/stellar-sdk");
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call("get_pending_admin");
  const sourceAccount = await server.getAccount(CONTRACT_ID).catch(() => null);
  const src = sourceAccount ?? { accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(30).build();
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    if (simResult.error?.includes("NoPendingAdmin")) return null;
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  const returnVal = simResult.result?.retval;
  if (!returnVal) return null;
  const raw = scValToNative(returnVal);
  if (!raw || !raw.new_admin) return null;
  return { newAdmin: raw.new_admin, proposedAt: Number(raw.proposed_at) };
}

export async function getAdminTimelock(): Promise<number> {
  const { Contract, TransactionBuilder, BASE_FEE, scValToNative, rpc } = await import("@stellar/stellar-sdk");
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call("get_admin_timelock");
  const sourceAccount = await server.getAccount(CONTRACT_ID).catch(() => null);
  const src = sourceAccount ?? { accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(30).build();
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  const returnVal = simResult.result?.retval;
  if (!returnVal) return 86400;
  return Number(scValToNative(returnVal));
}

export async function getAdmin(): Promise<string> {
  const { Contract, TransactionBuilder, BASE_FEE, scValToNative, rpc } = await import("@stellar/stellar-sdk");
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call("get_admin");
  const sourceAccount = await server.getAccount(CONTRACT_ID).catch(() => null);
  const src = sourceAccount ?? { accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(30).build();
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  const returnVal = simResult.result?.retval;
  if (!returnVal) throw new Error("No return value from get_admin");
  return scValToNative(returnVal);
}
