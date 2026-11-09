export interface RateLock {
  rate: number;
  lockedAt: Date;
  expiresAt: Date;
  assetCode?: string;
  currency?: string;
}

export function convertCurrency(amount: number, rate: number): number {
  return amount * rate;
}

export function lockExchangeRate(rate: number, durationSeconds: number = 300): RateLock {
  const now = new Date();
  return {
    rate,
    lockedAt: now,
    expiresAt: new Date(now.getTime() + durationSeconds * 1000),
    assetCode: 'USDC',
  };
}

export function isRateLockValid(lock: RateLock): boolean {
  return new Date() < lock.expiresAt;
}
