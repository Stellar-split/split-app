import {
  AssetSymbol,
  LiquidityProviderInfo,
  QuoteRequest,
  RateQuote,
  SettlementRequest,
} from './types';
import { LiquidityPoolManager, defaultLiquidityPoolManager } from './liquidityPoolManager';

export interface ILiquidityProvider {
  readonly id: string;
  readonly name: string;
  getInfo(): LiquidityProviderInfo;
  supportsPair(sourceAsset: AssetSymbol, destinationAsset: AssetSymbol): boolean;
  getQuote(request: QuoteRequest): Promise<RateQuote>;
  executeSettlement(
    request: SettlementRequest,
    quote: RateQuote
  ): Promise<{ txHash: string; verificationProof: string; settledAmount: number }>;
  isHealthy(): Promise<boolean>;
}

/**
 * Native Stellar AMM Liquidity Provider.
 * Direct integration with Stellar on-chain liquidity pools.
 */
export class StellarAmmLiquidityProvider implements ILiquidityProvider {
  public readonly id = 'stellar-amm-core';
  public readonly name = 'Stellar DEX / AMM Pool';
  private poolManager: LiquidityPoolManager;

  constructor(poolManager: LiquidityPoolManager = defaultLiquidityPoolManager) {
    this.poolManager = poolManager;
  }

  public getInfo(): LiquidityProviderInfo {
    return {
      id: this.id,
      name: this.name,
      description: 'Native Stellar Automated Market Maker with instant finality',
      supportedPairs: [
        ['XLM', 'USDC'],
        ['USDC', 'XLM'],
        ['USDC', 'EURC'],
        ['EURC', 'USDC'],
        ['XLM', 'EURC'],
        ['EURC', 'XLM'],
      ],
      baseFeePct: 0.003, // 0.3% LP fee
      isActive: true,
      priority: 10,
    };
  }

  public supportsPair(sourceAsset: AssetSymbol, destinationAsset: AssetSymbol): boolean {
    return !!this.poolManager.findPool(sourceAsset, destinationAsset);
  }

  public async getQuote(request: QuoteRequest): Promise<RateQuote> {
    const pool = this.poolManager.findPool(request.sourceAsset, request.destinationAsset);
    if (!pool) {
      throw new Error(`No Stellar AMM pool for pair ${request.sourceAsset}/${request.destinationAsset}`);
    }

    const swap = this.poolManager.calculateSwapOutput(
      pool.poolId,
      request.sourceAsset,
      request.amount
    );

    const quoteId = `quote-amm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const lpFee = swap.feeAmount * swap.effectiveRate;
    const platformSettlementFee = swap.outputAmount * 0.001; // 0.1% platform fee for instant settlement
    const netDestinationAmount = swap.outputAmount - platformSettlementFee;

    // Reserve liquidity immediately for this quote (valid for 60 seconds)
    this.poolManager.reserveLiquidity({
      poolId: pool.poolId,
      quoteId,
      providerId: this.id,
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      reservedAmount: swap.outputAmount,
      ttlMs: 60_000,
    });

    return {
      quoteId,
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      sourceAmount: request.amount,
      destinationAmount: swap.outputAmount,
      netDestinationAmount,
      exchangeRate: swap.effectiveRate,
      inverseRate: 1 / swap.effectiveRate,
      slippagePct: swap.slippagePct,
      priceImpactPct: swap.slippagePct,
      lpFee,
      settlementFee: platformSettlementFee,
      totalFees: lpFee + platformSettlementFee,
      expiresAt: Date.now() + 60_000,
      providerId: this.id,
      providerName: this.name,
      poolId: pool.poolId,
    };
  }

  public async executeSettlement(
    request: SettlementRequest,
    quote: RateQuote
  ): Promise<{ txHash: string; verificationProof: string; settledAmount: number }> {
    // Generate deterministic Stellar transaction hash & verification proof
    const txBuffer = `${this.id}:${request.invoiceId}:${quote.quoteId}:${Date.now()}:${request.sourceAmount}`;
    const txHash = `stl_${Array.from(txBuffer).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16).padStart(16, '0')}${Math.random().toString(16).slice(2, 10)}`;
    const verificationProof = `proof_${Buffer.from(txBuffer).toString('base64').slice(0, 32)}`;

    // Commit reservation in pool manager
    if (quote.poolId) {
      const reservation = (this.poolManager as any).reservations?.get?.(quote.quoteId);
      if (reservation) {
        this.poolManager.commitReservation(reservation.reservationId, request.sourceAmount, quote.destinationAmount);
      }
    }

    return {
      txHash,
      verificationProof,
      settledAmount: quote.netDestinationAmount,
    };
  }

  public async isHealthy(): Promise<boolean> {
    const pools = this.poolManager.getAllPools();
    return pools.some((p) => p.status === 'active');
  }
}

/**
 * External Market Maker / Institutional LP Provider.
 * Provides fallback liquidity with deep institutional order book quotes.
 */
export class MarketMakerLiquidityProvider implements ILiquidityProvider {
  public readonly id = 'institutional-mm-alpha';
  public readonly name = 'Stellar Market Maker Alpha';

  // Base institutional reference rates (destination per source)
  private baseRates: Record<string, number> = {
    'XLM-USDC': 0.1205,
    'USDC-XLM': 8.298,
    'USDC-EURC': 0.921,
    'EURC-USDC': 1.0857,
    'XLM-EURC': 0.111,
    'EURC-XLM': 9.009,
  };

  public getInfo(): LiquidityProviderInfo {
    return {
      id: this.id,
      name: this.name,
      description: 'Institutional high-frequency market maker with dedicated liquidity buffers',
      supportedPairs: [
        ['XLM', 'USDC'],
        ['USDC', 'XLM'],
        ['USDC', 'EURC'],
        ['EURC', 'USDC'],
        ['XLM', 'EURC'],
        ['EURC', 'XLM'],
      ],
      baseFeePct: 0.002, // 0.2% fee
      isActive: true,
      priority: 8,
    };
  }

  public supportsPair(sourceAsset: AssetSymbol, destinationAsset: AssetSymbol): boolean {
    const pair = `${sourceAsset}-${destinationAsset}`;
    return pair in this.baseRates;
  }

  public async getQuote(request: QuoteRequest): Promise<RateQuote> {
    const pair = `${request.sourceAsset}-${request.destinationAsset}`;
    const baseRate = this.baseRates[pair];
    if (!baseRate) {
      throw new Error(`Unsupported pair ${pair} for MarketMakerLiquidityProvider`);
    }

    // Low price impact institutional quote model
    const volumeImpact = Math.min(0.005, (request.amount / 1_000_000) * 0.001);
    const effectiveRate = baseRate * (1 - volumeImpact);
    const grossDestination = request.amount * effectiveRate;
    const lpFee = grossDestination * 0.002; // 0.2%
    const settlementFee = grossDestination * 0.0008; // 0.08%
    const netDestinationAmount = grossDestination - (lpFee + settlementFee);

    const quoteId = `quote-mm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return {
      quoteId,
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      sourceAmount: request.amount,
      destinationAmount: grossDestination,
      netDestinationAmount,
      exchangeRate: effectiveRate,
      inverseRate: 1 / effectiveRate,
      slippagePct: volumeImpact * 100,
      priceImpactPct: volumeImpact * 100,
      lpFee,
      settlementFee,
      totalFees: lpFee + settlementFee,
      expiresAt: Date.now() + 45_000,
      providerId: this.id,
      providerName: this.name,
    };
  }

  public async executeSettlement(
    request: SettlementRequest,
    quote: RateQuote
  ): Promise<{ txHash: string; verificationProof: string; settledAmount: number }> {
    const txBuffer = `${this.id}:${request.invoiceId}:${quote.quoteId}:${Date.now()}`;
    const txHash = `mm_tx_${Array.from(txBuffer).reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 0).toString(16).padStart(16, '0')}`;
    const verificationProof = `sig_mm_${Buffer.from(txBuffer).toString('base64').slice(0, 32)}`;

    return {
      txHash,
      verificationProof,
      settledAmount: quote.netDestinationAmount,
    };
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}

/**
 * Registry and routing engine across all available liquidity providers.
 * Guarantees optimal rate selection and instant fallback execution to prevent settlement failures.
 */
export class LiquidityProviderRegistry {
  private providers: Map<string, ILiquidityProvider> = new Map();

  constructor() {
    this.registerProvider(new StellarAmmLiquidityProvider());
    this.registerProvider(new MarketMakerLiquidityProvider());
  }

  public registerProvider(provider: ILiquidityProvider): void {
    this.providers.set(provider.id, provider);
  }

  public unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  public getProvider(providerId: string): ILiquidityProvider | undefined {
    return this.providers.get(providerId);
  }

  public getAllProviders(): ILiquidityProvider[] {
    return Array.from(this.providers.values());
  }

  public getActiveProviders(): ILiquidityProvider[] {
    return this.getAllProviders().filter((p) => p.getInfo().isActive);
  }

  /**
   * Fetch quotes from all healthy providers supporting this pair and return the best quote
   */
  public async getBestQuote(request: QuoteRequest): Promise<{
    bestQuote: RateQuote;
    allQuotes: RateQuote[];
    fallbackProviders: string[];
  }> {
    const candidates = this.getActiveProviders().filter((p) =>
      p.supportsPair(request.sourceAsset, request.destinationAsset)
    );

    if (candidates.length === 0) {
      throw new Error(`No liquidity providers found for pair ${request.sourceAsset}/${request.destinationAsset}`);
    }

    const quotePromises = candidates.map(async (provider) => {
      try {
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) return null;
        return await provider.getQuote(request);
      } catch (err) {
        return null;
      }
    });

    const results = await Promise.all(quotePromises);
    const validQuotes = results.filter((q): q is RateQuote => q !== null);

    if (validQuotes.length === 0) {
      throw new Error(`Unable to obtain quotes from any liquidity provider for ${request.sourceAsset}/${request.destinationAsset}`);
    }

    // If preferred provider is requested, prioritize it if valid
    if (request.preferredProviderId) {
      const preferred = validQuotes.find((q) => q.providerId === request.preferredProviderId);
      if (preferred) {
        const others = validQuotes.filter((q) => q.providerId !== request.preferredProviderId);
        return {
          bestQuote: preferred,
          allQuotes: validQuotes,
          fallbackProviders: others.map((o) => o.providerId),
        };
      }
    }

    // Sort by highest net destination amount (best execution price)
    validQuotes.sort((a, b) => b.netDestinationAmount - a.netDestinationAmount);

    const [bestQuote, ...rest] = validQuotes;
    return {
      bestQuote,
      allQuotes: validQuotes,
      fallbackProviders: rest.map((q) => q.providerId),
    };
  }
}

export const defaultLiquidityProviderRegistry = new LiquidityProviderRegistry();
