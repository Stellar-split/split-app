/**
 * Split payment execution engine.
 *
 * Handles splitting a single payment into multiple concurrent payments
 * to different recipients, with failure handling and confirmation tracking.
 */

import { calculateSplit, validateShares, type RecipientLine } from '@/hooks/useSplitCalculator';
import { validateSplitRules } from '@/lib/splitPaymentRules';
import type {
  SplitPaymentRequest,
  SplitPaymentResult,
  SplitPaymentConfirmation,
  RecipientPaymentResult,
  SplitPaymentStatus,
  PaymentExecutor,
  SplitRuleConfig,
} from '@/types/splitPayment';

// ── ID Generation ───────────────────────────────────────────────────────────

let _counter = 0;

/**
 * Generate a unique split payment ID.
 * Uses timestamp + counter for uniqueness within a session.
 */
export function generateSplitPaymentId(): string {
  _counter += 1;
  return `sp_${Date.now()}_${_counter}`;
}

// ── Confirmation ────────────────────────────────────────────────────────────

/**
 * Build a split payment confirmation object. This performs split calculations
 * and rule validation so the user can review before executing.
 */
export function buildSplitConfirmation(
  request: SplitPaymentRequest,
  ruleConfig: Partial<SplitRuleConfig> = {}
): SplitPaymentConfirmation {
  const splitResult = calculateSplit(
    request.totalAmount,
    request.recipients,
    request.assetCode
  );

  const { rules, allPassed } = validateSplitRules(
    request.totalAmount,
    request.recipients,
    ruleConfig
  );

  return {
    request,
    derivedLines: splitResult.derivedLines,
    validation: splitResult.validation,
    rules,
    allRulesPassed: allPassed,
    totalGross: splitResult.totalGross,
    totalTax: splitResult.totalTax,
    totalFees: splitResult.totalFees,
    totalNet: splitResult.totalNet,
    userConfirmed: false,
    createdAt: Date.now(),
  };
}

// ── Concurrent Execution ────────────────────────────────────────────────────

/**
 * Execute a single recipient payment with retry tracking.
 */
async function executeRecipientPayment(
  executor: PaymentExecutor,
  payerAddress: string,
  recipient: RecipientLine,
  amount: number,
  assetCode: 'XLM' | 'USDC',
  memo?: string,
  maxRetries: number = 2
): Promise<RecipientPaymentResult> {
  const result: RecipientPaymentResult = {
    address: recipient.address,
    amount,
    sharePercent: recipient.sharePercent,
    status: 'executing',
    retryCount: 0,
    initiatedAt: Date.now(),
  };

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { txHash } = await executor({
        payerAddress,
        recipientAddress: recipient.address,
        amount,
        assetCode,
        memo,
      });

      result.status = 'succeeded';
      result.txHash = txHash;
      result.completedAt = Date.now();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      result.retryCount = attempt + 1;

      if (attempt < maxRetries) {
        result.status = 'retrying';
        // Exponential backoff: 500ms, 1000ms, 2000ms...
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt))
        );
      }
    }
  }

  result.status = 'failed';
  result.error = lastError;
  result.completedAt = Date.now();
  return result;
}

/**
 * Execute split payments to all recipients concurrently.
 *
 * Uses Promise.allSettled to ensure all payments are attempted even if
 * some fail. Returns a comprehensive result object.
 */
export async function executeSplitPayment(
  request: SplitPaymentRequest,
  executor: PaymentExecutor,
  options: {
    maxRetries?: number;
    onRecipientComplete?: (result: RecipientPaymentResult, index: number) => void;
    onStatusChange?: (status: SplitPaymentStatus) => void;
  } = {}
): Promise<SplitPaymentResult> {
  const { maxRetries = 2, onRecipientComplete, onStatusChange } = options;

  // Calculate the split amounts
  const splitResult = calculateSplit(
    request.totalAmount,
    request.recipients,
    request.assetCode
  );

  // Validate shares before execution
  const validation = validateShares(request.recipients);
  if (!validation.isValid) {
    return {
      request,
      status: 'failed',
      recipientResults: [],
      successCount: 0,
      failureCount: request.recipients.length,
      totalDistributed: 0,
      totalFailed: request.totalAmount,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: validation.errorMessage || 'Invalid split configuration',
    };
  }

  onStatusChange?.('executing');

  const startedAt = Date.now();

  // Execute all recipient payments concurrently
  const paymentPromises = splitResult.derivedLines.map(async (line, index) => {
    const result = await executeRecipientPayment(
      executor,
      request.payerAddress,
      request.recipients[index],
      line.netAmount,
      request.assetCode,
      request.memo,
      maxRetries
    );

    onRecipientComplete?.(result, index);
    return result;
  });

  const recipientResults = await Promise.all(paymentPromises);

  // Aggregate results
  const successCount = recipientResults.filter((r) => r.status === 'succeeded').length;
  const failureCount = recipientResults.filter((r) => r.status === 'failed').length;
  const totalDistributed = recipientResults
    .filter((r) => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amount, 0);
  const totalFailed = recipientResults
    .filter((r) => r.status === 'failed')
    .reduce((sum, r) => sum + r.amount, 0);

  let status: SplitPaymentStatus;
  let error: string | undefined;

  if (failureCount === 0) {
    status = 'completed';
  } else if (successCount === 0) {
    status = 'failed';
    const errors = recipientResults
      .filter((r) => r.error)
      .map((r) => `${r.address}: ${r.error}`);
    error = `All payments failed: ${errors.join('; ')}`;
  } else {
    status = 'partial_failure';
    const errors = recipientResults
      .filter((r) => r.error)
      .map((r) => `${r.address}: ${r.error}`);
    error = `${failureCount} of ${recipientResults.length} payments failed: ${errors.join('; ')}`;
  }

  onStatusChange?.(status);

  return {
    request,
    status,
    recipientResults,
    successCount,
    failureCount,
    totalDistributed,
    totalFailed,
    startedAt,
    completedAt: Date.now(),
    error,
  };
}

/**
 * Get a human-readable summary of a split payment result.
 */
export function getSplitPaymentSummary(result: SplitPaymentResult): string {
  const { status, successCount, failureCount, totalDistributed, request } = result;

  switch (status) {
    case 'completed':
      return `Successfully distributed ${totalDistributed.toFixed(7)} ${request.assetCode} to ${successCount} recipients`;
    case 'partial_failure':
      return `Partially completed: ${successCount} succeeded, ${failureCount} failed. ${totalDistributed.toFixed(7)} ${request.assetCode} distributed`;
    case 'failed':
      return `Split payment failed: ${result.error || 'Unknown error'}`;
    default:
      return `Split payment status: ${status}`;
  }
}
