export function formatAssetAmount(amount: bigint, assetCode: string): string {
  const numberAmount = Number(amount);
  return `${numberAmount.toLocaleString()} ${assetCode}`;
}

export function formatBalance(amount: bigint | number, decimals: number = 2): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return num.toFixed(decimals);
}
