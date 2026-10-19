/**
 * Freighter wallet helpers for Next.js.
 *
 * All functions are safe to import in Server Components — they guard against
 * SSR by checking `typeof window` before calling browser-only Freighter APIs.
 */
import { enforceRateLimit, recordSecurityEvent, signLimiter } from "./walletSecurity";

import { getActiveNetwork } from "./networks";

/** Passphrase of the active network (user-selected in the browser, env default on the server). */
export const NETWORK_PASSPHRASE = getActiveNetwork().passphrase;

export type WalletType = "freighter" | "walletconnect";

/** Lazily load the WalletConnect v2 service (browser only). */
async function getWalletConnectService() {
  if (typeof window === "undefined") throw new Error("Browser only");
  return import("@/lib/walletconnect");
}

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

/** Connect WalletConnect and return the user's public key and QR URI. */
export async function connectWalletConnect(): Promise<{ publicKey: string; uri: string }> {
  if (typeof window === "undefined") throw new Error("Browser only");

  const { connectWalletConnect: connect } = await getWalletConnectService();
  return connect();
}

/** Get the WalletConnect public key if connected. */
export async function getWalletConnectPublicKey(): Promise<string | null> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const { getWalletConnectPublicKey: getKey } = await getWalletConnectService();
    return getKey();
  } catch {
    return null;
  }
}

/** Sign a transaction with WalletConnect. */
export async function signWithWalletConnect(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");

  const { signWithWalletConnect: sign } = await getWalletConnectService();
  return sign(xdr, NETWORK_PASSPHRASE);
}

/** Disconnect WalletConnect. */
export async function disconnectWalletConnect(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const { disconnectWalletConnect: disconnect } = await getWalletConnectService();
    await disconnect();
  } catch {
    // Ignore errors on disconnect
  }
}

/** Returns true if any supported wallet is currently connected. */
export async function isWalletConnected(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const wcKey = await getWalletConnectPublicKey();
    if (wcKey) return true;
  } catch { /* fall through */ }
  try {
    const key = await getFreighterPublicKey();
    return !!key;
  } catch {
    return false;
  }
}

/**
 * Sign a transaction with the currently connected wallet adapter.
 * Rate limited, and rejected/failed signatures are logged so repeated
 * unexpected signing prompts surface as suspicious activity.
 */
export async function signTransaction(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  enforceRateLimit(signLimiter, "sign", "transaction signing");

  try {
    // Try WalletConnect first if available
    let wcKey: string | null = null;
    try {
      wcKey = await getWalletConnectPublicKey();
    } catch {
      // WalletConnect not available, try Freighter
    }
    if (wcKey) return await signWithWalletConnect(xdr);

    // Fall back to Freighter
    return await signWithFreighter(xdr);
  } catch (e) {
    recordSecurityEvent({ type: "sign_rejected", detail: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Build the canonical co-signer approval message for an invoice. */
export function buildCoSignerApprovalMessage(invoiceId: string, address: string): string {
  return [
    "Stellar Split — Co-signer Approval",
    `Invoice: ${invoiceId}`,
    `Co-signer: ${address}`,
    `Network: ${NETWORK_PASSPHRASE}`,
  ].join("\n");
}

export interface CoSignerApprovalSignature {
  /** The co-signer address that produced the signature. */
  address: string;
  /** The invoice being approved. */
  invoiceId: string;
  /** The exact message that was signed (for server-side verification). */
  message: string;
  /** Base64-encoded signature returned by the wallet. */
  signature: string;
}

/**
 * Sign a co-signer approval for an invoice using the connected wallet.
 *
 * Builds a deterministic approval message and signs it via the active wallet
 * adapter (WalletConnect if connected, otherwise Freighter). Throws if no
 * wallet is connected so callers can prompt the user to connect first.
 */
export async function signCoSignerApproval(
  invoiceId: string,
  address: string,
): Promise<CoSignerApprovalSignature> {
  if (typeof window === "undefined") throw new Error("Browser only");
  if (!invoiceId) throw new Error("Invoice ID is required");
  if (!address) throw new Error("Co-signer address is required");

  const connected = await isWalletConnected();
  if (!connected) {
    throw new Error("Wallet not connected. Please connect your Freighter wallet.");
  }

  const message = buildCoSignerApprovalMessage(invoiceId, address);
  const signature = await signTransaction(message);

  return { address, invoiceId, message, signature };
}
