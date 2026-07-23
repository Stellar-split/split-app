interface WalletConnectKit {
  connect(): Promise<{ uri: string; publicKey: string }>;
  getPublicKey(): string | null;
  signTransaction(xdr: string, passphrase: string): Promise<string>;
  disconnect(): Promise<void>;
}

/**
 * Freighter browser extension injects itself onto `window.freighter`.
 * The @stellar/freighter-api package wraps this — typed here for direct access if needed.
 */
interface FreighterWindow {
  freighter?: {
    isConnected(): Promise<boolean>;
    getPublicKey(): Promise<string>;
    signTransaction(
      xdr: string,
      opts?: { network?: string; networkPassphrase?: string; accountToSign?: string }
    ): Promise<string>;
    getNetwork(): Promise<string>;
    getNetworkDetails(): Promise<{ network: string; networkPassphrase: string; sorobanRpcUrl?: string }>;
  };
}

declare global {
  interface Window extends FreighterWindow {}
}
