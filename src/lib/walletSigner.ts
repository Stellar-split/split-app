import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";

export interface SignTransactionOptions {
  address?: string;
  networkPassphrase?: string;
  network?: string;
}

export async function signTransaction(
  xdr: string,
  opts?: SignTransactionOptions
): Promise<string> {
  if (typeof freighterSignTransaction === "function") {
    const res = await freighterSignTransaction(xdr, opts as any);
    if (typeof res === "string") {
      return res;
    }
    if (res && typeof (res as any).signedTxXdr === "string") {
      return (res as any).signedTxXdr;
    }
  }
  return xdr;
}
