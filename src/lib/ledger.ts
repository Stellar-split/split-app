export const DEFAULT_LEDGER_DERIVATION_PATH = "m/44'/148'/0'/0/0";

export type LedgerStatus = 'disconnected' | 'connecting' | 'connected' | 'locked' | 'app_not_open' | 'error';

export interface LedgerConnectionStatus {
  status: LedgerStatus;
  publicKey?: string;
}

export interface LedgerError extends Error {
  code?: string;
  message: string;
}

export async function getLedgerPublicKey(path?: string): Promise<string> {
  return "";
}

export async function connectLedger(derivationPath?: string): Promise<string> {
  return "";
}

export async function getLedgerStatus(): Promise<LedgerConnectionStatus> {
  return { status: 'disconnected' };
}

export async function signWithLedger(xdr: string, networkPassphrase: string): Promise<string> {
  return "";
}

export async function disconnectLedger(): Promise<void> {
  // no-op
}

export function isLedgerError(error: unknown): error is LedgerError {
  if (!error) return false;
  const message = String((error as any)?.message || error || '').toLowerCase();
  const name = String((error as any)?.name || '').toLowerCase();
  return (
    message.includes('ledger') ||
    message.includes('transport') ||
    message.includes('device') ||
    name.includes('ledger')
  );
}
