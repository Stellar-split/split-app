export interface AccountBalance {
  asset: string;
  balance: string;
}

export async function fetchAccountBalances(publicKey: string): Promise<AccountBalance[]> {
  return [];
}
