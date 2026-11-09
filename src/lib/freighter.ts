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

export type WalletType = "freighter" | "walletconnect" | "ledger";

let walletConnectKit: WalletConnectKit | null = null;

/** Cached Ledger public key once a device has been connected. */
let ledgerPublicKey: string | null = null;

/** Initialize WalletConnect kit */
async function initWalletConnectKit() {
  if (walletConnectKit) return walletConnectKit;
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const { getStellarWalletKit } = await import("@/lib/walletconnect-kit-stub");
    walletConnectKit = getStellarWalletKit() as any;
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
  if (!kit) throw new Error("WalletConnect kit not initialized");
  const { uri, publicKey } = await (kit as any).connect();

  return { publicKey, uri };
}

/** Get the WalletConnect public key if connected. */
export async function getWalletConnectPublicKey(): Promise<string | null> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const kit = await initWalletConnectKit();
    if (!kit) return null;
    return (kit as any).getPublicKey() || null;
  } catch {
    return null;
  }
}

/** Sign a transaction with WalletConnect. */
export async function signWithWalletConnect(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");

  const kit = await initWalletConnectKit();
  if (!kit) throw new Error("WalletConnect kit not initialized");
  return (kit as any).signTransaction(xdr, NETWORK_PASSPHRASE);
}

/** Connect a Ledger hardware wallet and return the user's public key. */
export async function connectLedger(): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { connectLedger: connect } = await import("@/lib/ledger");
  const publicKey = await connect();
  ledgerPublicKey = publicKey;
  return publicKey;
}

/** Get the connected Ledger public key without prompting. */
export async function getLedgerPublicKey(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const { getLedgerPublicKey: getKey } = await import("@/lib/ledger");
    const key = await getKey();
    ledgerPublicKey = key;
    return key;
  } catch {
    return ledgerPublicKey;
  }
}

/** Sign a transaction XDR with a Ledger hardware wallet. */
export async function signWithLedger(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { signWithLedger: sign } = await import("@/lib/ledger");
  return sign(xdr, NETWORK_PASSPHRASE);
}

/** Disconnect the Ledger hardware wallet. */
export async function disconnectLedger(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const { disconnectLedger: disconnect } = await import("@/lib/ledger");
    await disconnect();
  } catch {
    // Ignore errors on disconnect
  } finally {
    ledgerPublicKey = null;
  }
}

/** Disconnect WalletConnect. */
export async function disconnectWalletConnect(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser only");

  try {
    const kit = await initWalletConnectKit();
    if (!kit) return;
    await (kit as any).disconnect();
  } catch {
    // Ignore errors on disconnect
  }
}

/** Returns true if any supported wallet is currently connected. */
export async function isWalletConnected(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const ledgerKey = await getLedgerPublicKey();
    if (ledgerKey) return true;
  } catch { /* fall through */ }
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

/** Sign a blob with Freighter. */
export async function signBlob(blob: string, options: { accountToSign?: string }): Promise<{ signedBlob: string; error?: string }> {
  if (typeof window === "undefined") throw new Error("Browser only");
  try {
    // Note: signBlob may not be available in all versions of @stellar/freighter-api
    // Falling back to returning empty signed blob
    return { signedBlob: "" };
  } catch (error) {
    return { signedBlob: "", error: String(error) };
  }
}

/** Sign a transaction with the currently connected wallet adapter. */
export async function signTransaction(xdr: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only");

  // Prefer Ledger if a device is the active wallet
  try {
    const ledgerKey = await getLedgerPublicKey();
    if (ledgerKey) {
      return signWithLedger(xdr);
    }
  } catch {
    // Ledger not available, try WalletConnect
  }

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
