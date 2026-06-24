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

export type WalletType = "freighter" | "walletconnect";

let walletConnectKit: any = null;

/** Initialize WalletConnect kit */
async function initWalletConnectKit() {
  if (walletConnectKit) return walletConnectKit;
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const { getStellarWalletKit } = await import("@/lib/walletconnect-kit-stub");
    walletConnectKit = getStellarWalletKit();
    return walletConnectKit;
  } catch {
    throw new Error("WalletConnect kit not available");
  }
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

  const kit = await initWalletConnectKit();
  const { uri, publicKey } = await kit.connect();

  return { publicKey, uri };
}

/** Get the WalletConnect public key if connected. */
export async function getWalletConnectPublicKey(): Promise<string | null> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const kit = await initWalletConnectKit();
    return kit.getPublicKey() || null;
  } catch {
    return null;
  }
}

/** Sign a transaction with WalletConnect. */
export async function signWithWalletConnect(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");

  const kit = await initWalletConnectKit();
  return kit.signTransaction(xdr, NETWORK_PASSPHRASE);
}

/** Disconnect WalletConnect. */
export async function disconnectWalletConnect(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const kit = await initWalletConnectKit();
    await kit.disconnect();
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

/** Sign a transaction with the currently connected wallet adapter. */
export async function signTransaction(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");

  // Try WalletConnect first if available
  try {
    const wcKey = await getWalletConnectPublicKey();
    if (wcKey) {
      return signWithWalletConnect(xdr);
    }
  } catch {
    // WalletConnect not available, try Freighter
  }

  // Fall back to Freighter
  return signWithFreighter(xdr);
}
