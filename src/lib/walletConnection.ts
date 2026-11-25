export interface WalletConnection {
  publicKey: string;
  timestamp: number;
}

export function getWalletConnection(): WalletConnection | null {
  return null;
}

export function getWalletPersistencePreference(): boolean {
  return false;
}

export function clearWalletConnection(): void {}

export function setWalletPersistencePreference(persist: boolean): void {}
