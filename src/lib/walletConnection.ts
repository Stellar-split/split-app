export interface WalletConnection {
  address: string;
  connected: boolean;
}

export function connectWallet(): Promise<WalletConnection> {
  return Promise.resolve({ address: '', connected: false });
}

export function disconnectWallet(): void {}
