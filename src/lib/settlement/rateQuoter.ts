import { QuoteRequest, RateQuote } from './types';
import {
  LiquidityProviderRegistry,
  defaultLiquidityProviderRegistry,
} from './liquidityProvider';

export class RateQuotingSystem {
  private quotes: Map<string, RateQuote> = new Map();
  private providerRegistry: LiquidityProviderRegistry;

  constructor(
    registry: LiquidityProviderRegistry = defaultLiquidityProviderRegistry
  ) {
    this.providerRegistry = registry;
  }

  /**
   * Request a fresh, accurate rate quote from the best available liquidity provider
   */
  public async requestQuote(request: QuoteRequest): Promise<RateQuote> {
    if (!request.sourceAsset || !request.destinationAsset) {
      throw new Error('Both sourceAsset and destinationAsset must be specified');
    }
    if (request.sourceAsset === request.destinationAsset) {
      throw new Error('Source and destination assets must differ');
    }
    if (!request.amount || request.amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    const { bestQuote } = await this.providerRegistry.getBestQuote(request);

    // Verify slippage tolerance if specified
    if (
      request.maxSlippagePct !== undefined &&
      bestQuote.slippagePct > request.maxSlippagePct
    ) {
      throw new Error(
        `Quoted slippage (${bestQuote.slippagePct.toFixed(2)}%) exceeds maximum acceptable slippage (${request.maxSlippagePct.toFixed(2)}%)`
      );
    }

    // Cache the active quote
    this.quotes.set(bestQuote.quoteId, bestQuote);
    return bestQuote;
  }

  /**
   * Retrieve an active quote by its unique ID
   */
  public getQuote(quoteId: string): RateQuote | undefined {
    const quote = this.quotes.get(quoteId);
    if (!quote) return undefined;

    if (Date.now() > quote.expiresAt) {
      this.quotes.delete(quoteId);
      return undefined;
    }

    return quote;
  }

  /**
   * Validate that a quote is still valid, unexpired, and within acceptable slippage bounds
   */
  public validateQuote(
    quoteId: string,
    maxSlippagePct: number = 2.0
  ): { isValid: boolean; quote?: RateQuote; reason?: string } {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      return { isValid: false, reason: 'Quote not found or expired from cache' };
    }

    if (Date.now() > quote.expiresAt) {
      this.quotes.delete(quoteId);
      return { isValid: false, reason: 'Quote has expired' };
    }

    if (quote.slippagePct > maxSlippagePct) {
      return {
        isValid: false,
        quote,
        reason: `Slippage (${quote.slippagePct.toFixed(2)}%) exceeds allowed threshold (${maxSlippagePct}%)`,
      };
    }

    return { isValid: true, quote };
  }

  /**
   * Consume or remove a quote after settlement
   */
  public consumeQuote(quoteId: string): void {
    this.quotes.delete(quoteId);
  }

  /**
   * Purge expired quotes from memory
   */
  public cleanExpiredQuotes(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, q] of Array.from(this.quotes.entries())) {
      if (now > q.expiresAt) {
        this.quotes.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const defaultRateQuotingSystem = new RateQuotingSystem();
