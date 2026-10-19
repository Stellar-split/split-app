import { formatAmount } from "@stellar-split/sdk";

export function formatXLM(amount: bigint): string {
  return Number(formatAmount(amount)).toFixed(7);
}

export function stroopsToXLM(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

/**
 * Default number of decimal places used per asset when no explicit precision
 * is provided. Stellar native assets use 7 decimals (stroops); most issued
 * tokens use 7 as well, but callers can override per asset.
 */
export const DEFAULT_ASSET_DECIMALS = 7;

/**
 * Default low-balance threshold (in whole asset units) used when no
 * configuration is supplied for an asset.
 */
export const DEFAULT_LOW_BALANCE_THRESHOLD = 1;

export interface AssetBalance {
  /** Asset code, e.g. "XLM", "USDC". */
  assetCode: string;
  /** Raw balance in the asset's smallest unit (e.g. stroops for XLM). */
  amount: bigint;
  /** Number of decimal places for this asset. Defaults to 7. */
  decimals?: number;
}

export interface LowBalanceThresholds {
  /** Threshold applied to any asset without a specific override. */
  default?: number;
  /** Per-asset-code threshold overrides, in whole asset units. */
  perAsset?: Record<string, number>;
}

export interface LowBalanceWarning {
  assetCode: string;
  /** Formatted balance, e.g. "0.5000000". */
  formattedBalance: string;
  /** Threshold (whole units) that was breached. */
  threshold: number;
  /** True when the balance is at or below the threshold. */
  isLow: boolean;
}

/**
 * Format a raw asset amount (smallest unit) into a human-readable string with
 * per-asset precision.
 */
export function formatAssetAmount(
  amount: bigint,
  assetCode: string,
  decimals: number = DEFAULT_ASSET_DECIMALS,
): string {
  const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : DEFAULT_ASSET_DECIMALS;
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(safeDecimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;

  if (safeDecimals === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionStr = fraction.toString().padStart(safeDecimals, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fractionStr}`;
}

/**
 * Format a raw asset amount and append the asset code, e.g. "12.5000000 USDC".
 */
export function formatBalanceWithCode(
  amount: bigint,
  assetCode: string,
  decimals: number = DEFAULT_ASSET_DECIMALS,
): string {
  return `${formatAssetAmount(amount, assetCode, decimals)} ${assetCode}`;
}

/**
 * Convert a raw asset amount (smallest unit) to a JS number in whole units.
 * Intended for threshold comparisons where exact precision is not critical.
 */
export function assetAmountToNumber(
  amount: bigint,
  decimals: number = DEFAULT_ASSET_DECIMALS,
): number {
  const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : DEFAULT_ASSET_DECIMALS;
  return Number(amount) / 10 ** safeDecimals;
}

/**
 * Resolve the low-balance threshold (in whole units) for a given asset.
 */
export function getLowBalanceThreshold(
  assetCode: string,
  thresholds?: LowBalanceThresholds,
): number {
  const override = thresholds?.perAsset?.[assetCode];
  if (typeof override === "number" && Number.isFinite(override)) {
    return override;
  }
  if (typeof thresholds?.default === "number" && Number.isFinite(thresholds.default)) {
    return thresholds.default;
  }
  return DEFAULT_LOW_BALANCE_THRESHOLD;
}

/**
 * Compute a low-balance warning for a single asset balance.
 */
export function computeLowBalanceWarning(
  balance: AssetBalance,
  thresholds?: LowBalanceThresholds,
): LowBalanceWarning {
  const decimals = balance.decimals ?? DEFAULT_ASSET_DECIMALS;
  const threshold = getLowBalanceThreshold(balance.assetCode, thresholds);
  const value = assetAmountToNumber(balance.amount, decimals);
  return {
    assetCode: balance.assetCode,
    formattedBalance: formatAssetAmount(balance.amount, balance.assetCode, decimals),
    threshold,
    isLow: value <= threshold,
  };
}

/**
 * Compute low-balance warnings for a list of asset balances. Returns only the
 * assets whose balances are at or below their configured thresholds.
 */
export function getLowBalanceWarnings(
  balances: AssetBalance[],
  thresholds?: LowBalanceThresholds,
): LowBalanceWarning[] {
  return balances
    .map((balance) => computeLowBalanceWarning(balance, thresholds))
    .filter((warning) => warning.isLow);
}