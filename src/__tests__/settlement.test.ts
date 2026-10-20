import { describe, it, expect, beforeEach } from 'vitest';
import {
  LiquidityPoolManager,
  StellarAmmLiquidityProvider,
  MarketMakerLiquidityProvider,
  LiquidityProviderRegistry,
  RateQuotingSystem,
  SettlementVerifier,
  SettlementFeeTracker,
  SettlementEngine,
  SettlementRecord,
} from '@/lib/settlement';

describe('Instant Payment Settlement System', () => {
  let poolManager: LiquidityPoolManager;
  let registry: LiquidityProviderRegistry;
  let quoter: RateQuotingSystem;
  let verifier: SettlementVerifier;
  let feeTracker: SettlementFeeTracker;
  let engine: SettlementEngine;

  beforeEach(() => {
    poolManager = new LiquidityPoolManager();
    poolManager.seedDefaultPools();

    const ammProvider = new StellarAmmLiquidityProvider(poolManager);
    const mmProvider = new MarketMakerLiquidityProvider();

    registry = new LiquidityProviderRegistry();
    // Clear and register known providers
    registry.getAllProviders().forEach((p) => registry.unregisterProvider(p.id));
    registry.registerProvider(ammProvider);
    registry.registerProvider(mmProvider);

    quoter = new RateQuotingSystem(registry);
    verifier = new SettlementVerifier();
    feeTracker = new SettlementFeeTracker();
    engine = new SettlementEngine({
      registry,
      quotingSystem: quoter,
      verifier,
      feeTracker,
    });
  });

  describe('Liquidity Pool Management', () => {
    it('initializes default liquidity pools with positive reserves', () => {
      const pools = poolManager.getAllPools();
      expect(pools.length).toBeGreaterThanOrEqual(3);

      const xlmUsdc = poolManager.findPool('XLM', 'USDC');
      expect(xlmUsdc).toBeDefined();
      expect(xlmUsdc?.reserveA).toBe(1_000_000);
      expect(xlmUsdc?.reserveB).toBe(120_000);
      expect(xlmUsdc?.status).toBe('active');
    });

    it('calculates AMM output and spot price accurately using constant product invariant', () => {
      const xlmUsdc = poolManager.findPool('XLM', 'USDC')!;
      const swap = poolManager.calculateSwapOutput(xlmUsdc.poolId, 'XLM', 1000);

      expect(swap.outputAmount).toBeGreaterThan(0);
      expect(swap.spotPrice).toBeCloseTo(0.12, 2);
      expect(swap.effectiveRate).toBeLessThan(swap.spotPrice); // Due to fee and price impact
      expect(swap.slippagePct).toBeGreaterThanOrEqual(0);
      expect(swap.outputAsset).toBe('USDC');
    });

    it('manages adding and removing liquidity correctly', () => {
      const pool = poolManager.createPool({
        poolId: 'pool-test-pair',
        assetA: 'AAA',
        assetB: 'BBB',
        reserveA: 10_000,
        reserveB: 10_000,
        providerId: 'test-lp',
      });

      expect(pool.totalShares).toBe(10_000);

      const added = poolManager.addLiquidity({
        poolId: 'pool-test-pair',
        amountA: 1_000,
        amountB: 1_000,
      });

      expect(added.sharesMinted).toBe(1_000);
      expect(pool.reserveA).toBe(11_000);
      expect(pool.reserveB).toBe(11_000);

      const removed = poolManager.removeLiquidity({
        poolId: 'pool-test-pair',
        shares: 1_100, // 10%
      });

      expect(removed.amountA).toBe(1_100);
      expect(removed.amountB).toBe(1_100);
      expect(pool.reserveA).toBe(9_900);
      expect(pool.reserveB).toBe(9_900);
    });

    it('tracks health metrics and alerts on high utilization', () => {
      const xlmUsdc = poolManager.findPool('XLM', 'USDC')!;
      const healthBefore = poolManager.getHealthMetrics(xlmUsdc.poolId);
      expect(healthBefore.healthy).toBe(true);
      expect(healthBefore.utilizationRate).toBe(0);

      // Reserve large liquidity
      poolManager.reserveLiquidity({
        poolId: xlmUsdc.poolId,
        quoteId: 'quote-test-large',
        providerId: 'stellar-amm-core',
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        reservedAmount: 110_000, // out of 120,000 = >90%
      });

      const healthAfter = poolManager.getHealthMetrics(xlmUsdc.poolId);
      expect(healthAfter.utilizationRate).toBeGreaterThan(0.85);
      expect(healthAfter.healthy).toBe(false);
      expect(healthAfter.alert).toContain('High utilization');
    });
  });

  describe('Rate Quoting System', () => {
    it('quotes rates accurately between supported currency pairs', async () => {
      const quote = await quoter.requestQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        amount: 500,
      });

      expect(quote).toBeDefined();
      expect(quote.quoteId).toBeDefined();
      expect(quote.sourceAmount).toBe(500);
      expect(quote.destinationAmount).toBeGreaterThan(0);
      expect(quote.netDestinationAmount).toBeLessThan(quote.destinationAmount);
      expect(quote.exchangeRate).toBeCloseTo(0.12, 1);
      expect(quote.expiresAt).toBeGreaterThan(Date.now());
    });

    it('enforces maximum slippage constraint when requested', async () => {
      await expect(
        quoter.requestQuote({
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          amount: 500_000, // very large swap causes high slippage on pool
          maxSlippagePct: 0.01, // 0.01% max slippage should fail
          preferredProviderId: 'stellar-amm-core',
        })
      ).rejects.toThrow(/exceeds maximum acceptable slippage/);
    });

    it('validates quote freshness and detects expired quotes', async () => {
      const quote = await quoter.requestQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        amount: 100,
      });

      const validation = quoter.validateQuote(quote.quoteId);
      expect(validation.isValid).toBe(true);

      // Force quote expiry
      quote.expiresAt = Date.now() - 1000;
      const expiredValidation = quoter.validateQuote(quote.quoteId);
      expect(expiredValidation.isValid).toBe(false);
      expect(expiredValidation.reason).toContain('expired');
    });
  });

  describe('Instant Settlement Execution & Zero Failure Guarantees', () => {
    it('executes settlements instantly with low latency', async () => {
      const quote = await quoter.requestQuote({
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        amount: 250,
      });

      const startTime = Date.now();
      const result = await engine.executeInstantSettlement({
        invoiceId: 'inv_101',
        quoteId: quote.quoteId,
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        sourceAmount: 250,
        expectedDestinationAmount: quote.netDestinationAmount,
        payerAddress: 'GB_PAYER_123',
        recipientAddress: 'GB_RECIPIENT_456',
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500); // Instant execution under 500ms
      expect(result.settlement.status).toBe('verified');
      expect(result.settlement.executionLatencyMs).toBeLessThan(200);
      expect(result.settlement.txHash).toBeDefined();
      expect(result.verification.verified).toBe(true);
    });

    it('falls back seamlessly to alternate liquidity provider to prevent settlement failures', async () => {
      // Create failing primary provider
      const failingProvider = {
        id: 'failing-primary',
        name: 'Failing Primary Provider',
        getInfo: () => ({
          id: 'failing-primary',
          name: 'Failing Primary Provider',
          description: 'Failing',
          supportedPairs: [['XLM', 'USDC']] as Array<[string, string]>,
          baseFeePct: 0.001,
          isActive: true,
          priority: 100,
        }),
        supportsPair: () => true,
        getQuote: async () => ({
          quoteId: 'quote-fail-1',
          sourceAsset: 'XLM',
          destinationAsset: 'USDC',
          sourceAmount: 100,
          destinationAmount: 12,
          netDestinationAmount: 11.9,
          exchangeRate: 0.12,
          inverseRate: 8.33,
          slippagePct: 0.1,
          priceImpactPct: 0.1,
          lpFee: 0.05,
          settlementFee: 0.05,
          totalFees: 0.1,
          expiresAt: Date.now() + 60_000,
          providerId: 'failing-primary',
          providerName: 'Failing Primary',
        }),
        executeSettlement: async () => {
          throw new Error('Connection refused to primary LP network');
        },
        isHealthy: async () => true,
      };

      registry.registerProvider(failingProvider);

      // Settlement must NOT fail, but cascade to MarketMaker provider
      const result = await engine.executeInstantSettlement({
        invoiceId: 'inv_resilience',
        quoteId: 'quote-fail-1',
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        sourceAmount: 100,
        expectedDestinationAmount: 11.9,
        payerAddress: 'GB_PAYER_RESILIENT',
        recipientAddress: 'GB_RECIPIENT_RESILIENT',
      });

      expect(result.settlement).toBeDefined();
      expect(result.settlement.status).toBe('verified');
      expect(result.verification.verified).toBe(true);
      expect(result.settlement.providerId).not.toBe('failing-primary');
    });
  });

  describe('Settlement Verification', () => {
    it('confirms genuine settlements with valid proof, amounts, and hashes', () => {
      const mockSettlement: SettlementRecord = {
        settlementId: 'stl_valid_1',
        invoiceId: 'inv_102',
        quoteId: 'quote_1',
        providerId: 'stellar-amm-core',
        payerAddress: 'GB_PAYER',
        recipientAddress: 'GB_RECIPIENT',
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        sourceAmount: 100,
        grossDestinationAmount: 12,
        netDestinationAmount: 11.88,
        exchangeRate: 0.12,
        slippagePct: 0.05,
        lpFee: 0.1,
        settlementFee: 0.02,
        networkFee: 0.00001,
        totalFee: 0.12001,
        status: 'settled',
        txHash: 'stl_abcdef1234567890',
        verificationProof: 'proof_mock_valid_signature_123',
        executionLatencyMs: 15,
        settledAt: Date.now(),
      };

      const verification = verifier.verifySettlement(mockSettlement);
      expect(verification.verified).toBe(true);
      expect(verification.proofValid).toBe(true);
      expect(verification.amountValid).toBe(true);
      expect(verification.recipientValid).toBe(true);
      expect(verification.discrepancies.length).toBe(0);
    });

    it('flags discrepancies on tampered transaction hash or missing recipient', () => {
      const tamperedSettlement: SettlementRecord = {
        settlementId: 'stl_tampered',
        invoiceId: 'inv_103',
        quoteId: 'quote_2',
        providerId: 'stellar-amm-core',
        payerAddress: 'GB_PAYER',
        recipientAddress: '', // Empty recipient
        sourceAsset: 'XLM',
        destinationAsset: 'USDC',
        sourceAmount: 100,
        grossDestinationAmount: 12,
        netDestinationAmount: 11.88,
        exchangeRate: 0.12,
        slippagePct: 0.05,
        lpFee: 0.1,
        settlementFee: 0.02,
        networkFee: 0.00001,
        totalFee: 0.12,
        status: 'settled',
        txHash: 'invalid_hash', // Invalid prefix/length
        verificationProof: 'short', // Too short
        executionLatencyMs: 20,
        settledAt: Date.now(),
      };

      const verification = verifier.verifySettlement(tamperedSettlement);
      expect(verification.verified).toBe(false);
      expect(verification.discrepancies.length).toBeGreaterThanOrEqual(2);
      expect(verification.discrepancies.some((d) => d.includes('transaction hash'))).toBe(true);
      expect(verification.discrepancies.some((d) => d.includes('recipient'))).toBe(true);
    });
  });

  describe('Settlement Fee Tracking', () => {
    it('records fees accurately and computes aggregate summaries', () => {
      feeTracker.recordFee({
        settlementId: 'stl_fee_1',
        invoiceId: 'inv_201',
        providerId: 'stellar-amm-core',
        asset: 'USDC',
        lpFee: 0.30,
        platformSettlementFee: 0.10,
        networkFee: 0.00001,
        totalFee: 0.40001,
        timestamp: Date.now(),
      });

      feeTracker.recordFee({
        settlementId: 'stl_fee_2',
        invoiceId: 'inv_202',
        providerId: 'stellar-amm-core',
        asset: 'USDC',
        lpFee: 0.60,
        platformSettlementFee: 0.20,
        networkFee: 0.00001,
        totalFee: 0.80001,
        timestamp: Date.now(),
      });

      const summary = feeTracker.getSummary('USDC');
      expect(summary.settlementCount).toBe(2);
      expect(summary.totalLpFees).toBeCloseTo(0.90, 4);
      expect(summary.totalPlatformFees).toBeCloseTo(0.30, 4);
      expect(summary.totalFees).toBeCloseTo(1.20002, 4);
      expect(summary.averageFeePerSettlement).toBeCloseTo(0.60001, 4);

      const invoiceFees = feeTracker.getFeesByInvoice('inv_201');
      expect(invoiceFees.length).toBe(1);
      expect(invoiceFees[0].lpFee).toBe(0.30);
    });
  });
});
