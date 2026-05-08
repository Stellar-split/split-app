/**
 * Freighter wallet helpers for Next.js.
 *
 * All functions are safe to import in Server Components — they guard against
 * SSR by checking `typeof window` before calling browser-only Freighter APIs.
 */

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

/** Connect Freighter and return the user's public key. */
export async function connectFreighter(): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { connectWallet } = await import("@stellar-split/sdk");
  return connectWallet();
}

/** Get the connected wallet's public key without prompting. */
export async function getFreighterPublicKey(): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { getPublicKey } = await import("@stellar-split/sdk");
  return getPublicKey();
}

/** Sign a transaction XDR with Freighter. */
export async function signWithFreighter(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { signTransaction } = await import("@stellar-split/sdk");
  return signTransaction(xdr, NETWORK_PASSPHRASE);
}
