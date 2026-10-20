/**
 * Types and interfaces for Instant Payment Settlement with Liquidity Providers.
 */

export type AssetSymbol = string;

export interface LiquidityProviderInfo {
  id: string;
  name: string;
  description: string;
  supportedPairs: Array<[AssetSymbol, AssetSymbol]>;
  baseFeePct: number; // e.g. 0.002 for 0.2%
  isActive: boolean;
  priority: number; // higher priority is preferred
}

export interface QuoteRequest {
  sourceAsset: AssetSymbol;
  destinationAsset: AssetSymbol;
  amount: number;
  isSourceAmount?: boolean;
  maxSlippagePct?: number; // default e.g. 0.5%
  preferredProviderId?: string;
  invoiceId?: string;
}

export interface RateQuote {
  quoteId: string;
  sourceAsset: AssetSymbol;
  destinationAsset: AssetSymbol;
  sourceAmount: number;
  destinationAmount: number;
  netDestinationAmount: number;
  exchangeRate: number; // destinationAmount / sourceAmount
  inverseRate: number;  // sourceAmount / destinationAmount
  slippagePct: number;
  priceImpactPct: number;
  lpFee: number;
  settlementFee: number;
  totalFees: number;
  expiresAt: number; // timestamp in ms
  providerId: string;
  providerName: string;
  poolId?: string;
}

export interface LiquidityReservation {
  reservationId: string;
  quoteId: string;
  poolId?: string;
  providerId: string;
  sourceAsset: AssetSymbol;
  destinationAsset: AssetSymbol;
  reservedAmount: number;
  expiresAt: number;
  status: 'active' | 'consumed' | 'released' | 'expired';
}

export interface LiquidityPool {
  poolId: string;
  assetA: AssetSymbol;
  assetB: AssetSymbol;
  reserveA: number;
  reserveB: number;
  lockedReserveA: number;
  lockedReserveB: number;
  totalShares: number;
  feeRate: number; // e.g. 0.003 = 0.3%
  providerId: string;
  utilizationRate: number; // 0 to 1
  volume24h: number;
  status: 'active' | 'low_liquidity' | 'paused';
  lastUpdated: number;
}

export interface AddLiquidityParams {
  poolId: string;
  amountA: number;
  amountB: number;
  providerAddress: string;
}

export interface RemoveLiquidityParams {
  poolId: string;
  shares: number;
  providerAddress: string;
}

export interface SettlementRequest {
  settlementId?: string;
  invoiceId: string;
  quoteId: string;
  sourceAsset: AssetSymbol;
  destinationAsset: AssetSymbol;
  sourceAmount: number;
  expectedDestinationAmount: number;
  payerAddress: string;
  recipientAddress: string;
  maxSlippagePct?: number;
  instant?: boolean;
}

export type SettlementStatus = 'pending' | 'settling' | 'settled' | 'verified' | 'failed';

export interface SettlementRecord {
  settlementId: string;
  invoiceId: string;
  quoteId: string;
  providerId: string;
  payerAddress: string;
  recipientAddress: string;
  sourceAsset: AssetSymbol;
  destinationAsset: AssetSymbol;
  sourceAmount: number;
  grossDestinationAmount: number;
  netDestinationAmount: number;
  exchangeRate: number;
  slippagePct: number;
  lpFee: number;
  settlementFee: number;
  networkFee: number;
  totalFee: number;
  status: SettlementStatus;
  txHash: string;
  verificationProof: string;
  executionLatencyMs: number;
  settledAt: number;
  verifiedAt?: number;
  failureReason?: string;
}

export interface SettlementVerificationResult {
  settlementId: string;
  verified: boolean;
  verifiedAt: number;
  txHash: string;
  proofValid: boolean;
  amountValid: boolean;
  recipientValid: boolean;
  timingValid: boolean;
  settlementRecord?: SettlementRecord;
  discrepancies: string[];
}

export interface SettlementFeeRecord {
  feeId: string;
  settlementId: string;
  invoiceId: string;
  providerId: string;
  asset: AssetSymbol;
  lpFee: number;
  platformSettlementFee: number;
  networkFee: number;
  totalFee: number;
  timestamp: number;
}

export interface FeeSummary {
  asset: AssetSymbol;
  totalLpFees: number;
  totalPlatformFees: number;
  totalNetworkFees: number;
  totalFees: number;
  settlementCount: number;
  averageFeePerSettlement: number;
}

export interface LiquidityHealthMetric {
  poolId: string;
  pair: string;
  totalLiquidityUsd: number;
  availableReserveA: number;
  availableReserveB: number;
  utilizationRate: number;
  healthy: boolean;
  alert?: string;
}
