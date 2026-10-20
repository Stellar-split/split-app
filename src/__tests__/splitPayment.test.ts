import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSplitPaymentId,
  buildSplitConfirmation,
  executeSplitPayment,
  getSplitPaymentSummary,
} from '@/lib/splitPayment';
import {
  validateMinAmount,
  validateMaxAmount,
  validateMaxRecipients,
  validateMinSharePercent,
  validateUniqueAddresses,
  validateAddresses,
  validateSufficientBalance,
  validateSplitRules,
} from '@/lib/splitPaymentRules';
import type {
  SplitPaymentRequest,
  PaymentExecutor,
} from '@/types/splitPayment';
import type { RecipientLine } from '@/hooks/useSplitCalculator';

const VALID_ADDR_1 = 'GDNJ22TG7PGTDFB46L7TA3R6S4F7Z3HQALNPYZ5BTRUT7Y2L73PBGBH5';
const VALID_ADDR_2 = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const VALID_ADDR_3 = 'GCKF7343QGVT6H767XPR3F5Z5EPLN6K425F4C7U2X5V73MDKUPOXF65V';
const PAYER_ADDR = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

describe('Split Payment Rules Validation', () => {
  const recipients: RecipientLine[] = [
    { address: VALID_ADDR_1, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
    { address: VALID_ADDR_2, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
  ];

  it('validates minimum recipient amount', () => {
    // 50% of 0.0000001 is 0.00000005, which is < 0.0000001
    const ruleFail = validateMinAmount(0.0000001, recipients, 0.0000001);
    expect(ruleFail.passed).toBe(false);

    const rulePass = validateMinAmount(100, recipients, 1);
    expect(rulePass.passed).toBe(true);
  });

  it('validates maximum total amount', () => {
    const rulePass = validateMaxAmount(500, 1000);
    expect(rulePass.passed).toBe(true);

    const ruleFail = validateMaxAmount(1500, 1000);
    expect(ruleFail.passed).toBe(false);
  });

  it('validates maximum recipients', () => {
    const rulePass = validateMaxRecipients(recipients, 5);
    expect(rulePass.passed).toBe(true);

    const ruleFail = validateMaxRecipients(recipients, 1);
    expect(ruleFail.passed).toBe(false);
  });

  it('validates minimum share percentage', () => {
    const uneven: RecipientLine[] = [
      { address: VALID_ADDR_1, sharePercent: 99.999, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: VALID_ADDR_2, sharePercent: 0.001, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const rulePass = validateMinSharePercent(recipients, 1);
    expect(rulePass.passed).toBe(true);

    const ruleFail = validateMinSharePercent(uneven, 0.01);
    expect(ruleFail.passed).toBe(false);
  });

  it('validates unique addresses', () => {
    const duplicates: RecipientLine[] = [
      { address: VALID_ADDR_1, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: VALID_ADDR_1, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    expect(validateUniqueAddresses(recipients).passed).toBe(true);
    expect(validateUniqueAddresses(duplicates).passed).toBe(false);
  });

  it('validates Stellar public keys', () => {
    const invalidList: RecipientLine[] = [
      { address: 'invalid_address', sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: VALID_ADDR_2, sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    expect(validateAddresses(recipients).passed).toBe(true);
    expect(validateAddresses(invalidList).passed).toBe(false);
  });

  it('validates sufficient balance', () => {
    expect(validateSufficientBalance(100, 150).passed).toBe(true);
    expect(validateSufficientBalance(100, 50).passed).toBe(false);
    expect(validateSufficientBalance(100, undefined).passed).toBe(true); // skips check
  });

  it('runs all rules aggregated with validateSplitRules', () => {
    const res = validateSplitRules(100, recipients);
    expect(res.allPassed).toBe(true);
    expect(res.rules.length).toBeGreaterThanOrEqual(6);

    const badRes = validateSplitRules(100, [
      { address: 'not-stellar', sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: 'not-stellar', sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
    ]);
    expect(badRes.allPassed).toBe(false);
  });
});

describe('Split Payment Confirmation & Execution', () => {
  const request: SplitPaymentRequest = {
    id: generateSplitPaymentId(),
    payerAddress: PAYER_ADDR,
    totalAmount: 100,
    assetCode: 'USDC',
    recipients: [
      { address: VALID_ADDR_1, sharePercent: 60, taxRatePercent: 10, fixedFeeXLM: 0 },
      { address: VALID_ADDR_2, sharePercent: 40, taxRatePercent: 0, fixedFeeXLM: 0 },
    ],
  };

  it('builds confirmation correctly with accurate calculations', () => {
    const confirmation = buildSplitConfirmation(request);
    expect(confirmation.allRulesPassed).toBe(true);
    expect(confirmation.userConfirmed).toBe(false);
    expect(confirmation.totalGross).toBe(100);

    // Recipient 1: 60 gross, 10% tax = 6 tax, 54 net
    expect(confirmation.derivedLines[0].grossAmount).toBe(60);
    expect(confirmation.derivedLines[0].effectiveTaxAmount).toBe(6);
    expect(confirmation.derivedLines[0].netAmount).toBe(54);

    // Recipient 2: 40 gross, 0 tax, 40 net
    expect(confirmation.derivedLines[1].grossAmount).toBe(40);
    expect(confirmation.derivedLines[1].netAmount).toBe(40);

    expect(confirmation.totalNet).toBe(94);
  });

  it('executes payments concurrently to all recipients', async () => {
    const mockExecutor: PaymentExecutor = vi.fn().mockImplementation(async ({ recipientAddress }) => {
      return { txHash: `tx_${recipientAddress.slice(0, 8)}` };
    });

    const onComplete = vi.fn();
    const result = await executeSplitPayment(request, mockExecutor, {
      maxRetries: 1,
      onRecipientComplete: onComplete,
    });

    expect(result.status).toBe('completed');
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.recipientResults).toHaveLength(2);
    expect(mockExecutor).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(2);

    expect(result.recipientResults[0].status).toBe('succeeded');
    expect(result.recipientResults[0].amount).toBe(54);
    expect(result.recipientResults[0].txHash).toBe(`tx_${VALID_ADDR_1.slice(0, 8)}`);

    expect(result.recipientResults[1].status).toBe('succeeded');
    expect(result.recipientResults[1].amount).toBe(40);

    expect(result.totalDistributed).toBe(94);
    expect(result.totalFailed).toBe(0);

    const summary = getSplitPaymentSummary(result);
    expect(summary).toContain('Successfully distributed');
  });

  it('handles partial failures gracefully', async () => {
    // Fail recipient 1, succeed recipient 2
    const mockExecutor: PaymentExecutor = vi.fn().mockImplementation(async ({ recipientAddress }) => {
      if (recipientAddress === VALID_ADDR_1) {
        throw new Error('Destination account inactive');
      }
      return { txHash: 'tx_success' };
    });

    const result = await executeSplitPayment(request, mockExecutor, {
      maxRetries: 1,
    });

    expect(result.status).toBe('partial_failure');
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.totalDistributed).toBe(40);
    expect(result.totalFailed).toBe(54);
    expect(result.error).toContain('1 of 2 payments failed');

    const summary = getSplitPaymentSummary(result);
    expect(summary).toContain('Partially completed');
  });

  it('handles complete failures gracefully', async () => {
    const mockExecutor: PaymentExecutor = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await executeSplitPayment(request, mockExecutor, {
      maxRetries: 0,
    });

    expect(result.status).toBe('failed');
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
    expect(result.totalDistributed).toBe(0);
    expect(result.totalFailed).toBe(94);
    expect(result.error).toContain('All payments failed');
  });

  it('fails fast on invalid shares before initiating any payment', async () => {
    const invalidRequest: SplitPaymentRequest = {
      ...request,
      recipients: [
        { address: VALID_ADDR_1, sharePercent: 40, taxRatePercent: 0, fixedFeeXLM: 0 },
        { address: VALID_ADDR_2, sharePercent: 40, taxRatePercent: 0, fixedFeeXLM: 0 },
      ],
    };

    const mockExecutor: PaymentExecutor = vi.fn();
    const result = await executeSplitPayment(invalidRequest, mockExecutor);

    expect(result.status).toBe('failed');
    expect(mockExecutor).not.toHaveBeenCalled();
    expect(result.error).toContain('Share percentages must sum to 100%');
  });
});
