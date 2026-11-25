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
} from '../lib/settlement';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllChecks() {
  console.log('--- Starting Settlement System Verification ---');

  // 1. Liquidity Pool Management
  console.log('Testing: Liquidity Pool Management...');
  const poolManager = new LiquidityPoolManager();
  poolManager.seedDefaultPools();

  const pools = poolManager.getAllPools();
  assert(pools.length >= 3, 'Should initialize at least 3 default pools');

  const xlmUsdc = poolManager.findPool('XLM', 'USDC');
  assert(!!xlmUsdc, 'XLM/USDC pool should exist');
  assert(xlmUsdc!.reserveA === 1_000_000, 'XLM reserve should be 1M');
  assert(xlmUsdc!.reserveB === 120_000, 'USDC reserve should be 120k');

  const swap = poolManager.calculateSwapOutput(xlmUsdc!.poolId, 'XLM', 1000);
  assert(swap.outputAmount > 0, 'Swap output should be positive');
  assert(Math.abs(swap.spotPrice - 0.12) < 0.01, 'Spot price should be ~0.12');
  assert(swap.outputAsset === 'USDC', 'Output asset should be USDC');
  assert(swap.slippagePct >= 0, 'Slippage should be non-negative');

  // Add liquidity
  const added = poolManager.addLiquidity({
    poolId: xlmUsdc!.poolId,
    amountA: 10_000,
    amountB: 1_200,
  });
  assert(added.sharesMinted > 0, 'Shares should be minted');

  // Health metrics
  const health = poolManager.getHealthMetrics(xlmUsdc!.poolId);
  assert(health.healthy === true, 'Pool should be healthy initially');
  console.log('✓ Liquidity Pool Management: PASSED');

  // 2. Liquidity Provider Integrations
  console.log('Testing: Liquidity Provider Integrations...');
  const ammProvider = new StellarAmmLiquidityProvider(poolManager);
  const mmProvider = new MarketMakerLiquidityProvider();
  const registry = new LiquidityProviderRegistry();
  registry.registerProvider(ammProvider);
  registry.registerProvider(mmProvider);

  assert(ammProvider.supportsPair('XLM', 'USDC'), 'AMM should support XLM/USDC');
  assert(mmProvider.supportsPair('XLM', 'USDC'), 'MM should support XLM/USDC');
  assert(await ammProvider.isHealthy(), 'AMM provider should be healthy');
  assert(await mmProvider.isHealthy(), 'MM provider should be healthy');
  console.log('✓ Liquidity Provider Integrations: PASSED');

  // 3. Rate Quoting System
  console.log('Testing: Rate Quoting System...');
  const quoter = new RateQuotingSystem(registry);
  const quote = await quoter.requestQuote({
    sourceAsset: 'XLM',
    destinationAsset: 'USDC',
    amount: 500,
  });
  assert(!!quote.quoteId, 'Quote should have an ID');
  assert(quote.sourceAmount === 500, 'Source amount should match');
  assert(quote.destinationAmount > 0, 'Destination amount should be positive');
  assert(quote.netDestinationAmount < quote.destinationAmount, 'Net should account for fees');
  assert(quote.expiresAt > Date.now(), 'Quote should have future expiry');

  const validQuote = quoter.validateQuote(quote.quoteId);
  assert(validQuote.isValid, 'Quote should be valid');
  console.log('✓ Rate Quoting System: PASSED');

  // 4. Instant Settlement Logic & Zero Failure Guarantee
  console.log('Testing: Instant Settlement Logic...');
  const verifier = new SettlementVerifier();
  const feeTracker = new SettlementFeeTracker();
  const engine = new SettlementEngine({
    registry,
    quotingSystem: quoter,
    verifier,
    feeTracker,
  });

  const start = Date.now();
  const settlementResult = await engine.executeInstantSettlement({
    invoiceId: 'inv_prod_001',
    quoteId: quote.quoteId,
    sourceAsset: 'XLM',
    destinationAsset: 'USDC',
    sourceAmount: 500,
    expectedDestinationAmount: quote.netDestinationAmount,
    payerAddress: 'GB_TEST_PAYER_KEY',
    recipientAddress: 'GB_TEST_RECIPIENT_KEY',
  });
  const latency = Date.now() - start;

  assert(latency < 1000, `Settlement should execute instantly (<1000ms), took ${latency}ms`);
  assert(settlementResult.settlement.status === 'verified', 'Settlement should be verified');
  assert(settlementResult.verification.verified === true, 'Verification should be true');
  assert(settlementResult.settlement.txHash.length > 10, 'Transaction hash should be populated');
  assert(settlementResult.settlement.verificationProof.length > 10, 'Proof should be populated');
  console.log(`✓ Instant Settlement Logic: PASSED (${latency}ms execution)`);

  // 5. Settlement Verification
  console.log('Testing: Settlement Verification...');
  const verifyAgain = verifier.verifySettlement(settlementResult.settlement);
  assert(verifyAgain.verified === true, 'Verification should confirm genuine settlement');
  assert(verifyAgain.discrepancies.length === 0, 'There should be zero discrepancies');

  const tampered: SettlementRecord = {
    ...settlementResult.settlement,
    txHash: 'invalid',
  };
  const tamperedResult = verifier.verifySettlement(tampered);
  assert(tamperedResult.verified === false, 'Tampered txHash should fail verification');
  console.log('✓ Settlement Verification: PASSED');

  // 6. Settlement Fee Tracking
  console.log('Testing: Settlement Fee Tracking...');
  const invoiceFees = feeTracker.getFeesByInvoice('inv_prod_001');
  assert(invoiceFees.length === 1, 'Should track fees for the invoice');
  assert(invoiceFees[0].lpFee > 0, 'LP fee should be greater than 0');
  assert(invoiceFees[0].platformSettlementFee > 0, 'Platform fee should be greater than 0');

  const summary = feeTracker.getSummary('USDC');
  assert(summary.settlementCount === 1, 'Summary should have 1 settlement');
  assert(summary.totalFees > 0, 'Total fees should be tracked');
  console.log('✓ Settlement Fee Tracking: PASSED');

  console.log('\n=======================================');
  console.log('ALL SETTLEMENT ACCEPTANCE CRITERIA PASSED!');
  console.log('=======================================');
}

runAllChecks().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
