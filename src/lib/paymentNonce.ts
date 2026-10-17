import { NETWORK_PASSPHRASE } from "./freighter";
import { getActiveNetwork } from "@/lib/networks";

const RPC_URL = getActiveNetwork().rpcUrl;
const CONTRACT_ID = getActiveNetwork().contractId;

export async function getPayerNonce(payer: string): Promise<bigint> {
  const { Contract, TransactionBuilder, BASE_FEE, nativeToScVal, scValToNative, rpc } = await import("@stellar/stellar-sdk");
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call("get_payer_nonce", nativeToScVal(payer, { type: "address" }));
  const sourceAccount = await server.getAccount(CONTRACT_ID).catch(() => null);
  const src = sourceAccount ?? { accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} };
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation).setTimeout(30).build();
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }
  const returnVal = simResult.result?.retval;
  if (!returnVal) return 0n;
  return BigInt(scValToNative(returnVal));
}
