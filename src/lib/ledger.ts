export const DEFAULT_LEDGER_DERIVATION_PATH = "m/44'/148'/0'/0/0";

export async function getLedgerPublicKey(path?: string): Promise<string> {
  return "";
}

export async function connectLedger(): Promise<any> {
  return null;
}

export async function getLedgerStatus(): Promise<string> {
  return "disconnected";
}
