'use client';

import { useState, useCallback } from 'react';
import {
  buildSplitConfirmation,
  executeSplitPayment,
  generateSplitPaymentId,
} from '@/lib/splitPayment';
import type {
  SplitPaymentState,
  SplitPaymentRequest,
  SplitPaymentConfirmation,
  SplitPaymentResult,
  PaymentExecutor,
  SplitRuleConfig,
  RecipientPaymentResult,
} from '@/types/splitPayment';
import type { RecipientLine } from '@/hooks/useSplitCalculator';

const INITIAL_STATE: SplitPaymentState = {
  status: 'pending',
  confirmation: null,
  result: null,
  isExecuting: false,
  error: null,
};

export interface UseSplitPaymentOptions {
  /** Payment executor function — abstracted for testability */
  executor: PaymentExecutor;
  /** Rule configuration overrides */
  ruleConfig?: Partial<SplitRuleConfig>;
  /** Maximum retries per recipient */
  maxRetries?: number;
  /** Callback when a single recipient payment completes */
  onRecipientComplete?: (result: RecipientPaymentResult, index: number) => void;
  /** Callback when the overall split payment completes */
  onComplete?: (result: SplitPaymentResult) => void;
}

export interface UseSplitPaymentReturn {
  /** Current split payment state */
  state: SplitPaymentState;
  /** Build a confirmation for the user to review before executing */
  prepareSplit: (
    payerAddress: string,
    totalAmount: number,
    assetCode: 'XLM' | 'USDC',
    recipients: RecipientLine[],
    options?: { memo?: string; invoiceId?: string }
  ) => SplitPaymentConfirmation;
  /** Confirm and execute the split payment */
  confirmAndExecute: () => Promise<SplitPaymentResult | null>;
  /** Cancel the pending split payment */
  cancel: () => void;
  /** Reset state to initial */
  reset: () => void;
}

/**
 * React hook for managing split payment distribution.
 *
 * Provides a workflow:
 * 1. `prepareSplit()` — build a confirmation with calculated amounts & rule validation
 * 2. User reviews the confirmation in the UI
 * 3. `confirmAndExecute()` — execute all recipient payments concurrently
 * 4. Track results in `state.result`
 */
export function useSplitPayment(options: UseSplitPaymentOptions): UseSplitPaymentReturn {
  const { executor, ruleConfig, maxRetries = 2, onRecipientComplete, onComplete } = options;
  const [state, setState] = useState<SplitPaymentState>(INITIAL_STATE);

  const prepareSplit = useCallback(
    (
      payerAddress: string,
      totalAmount: number,
      assetCode: 'XLM' | 'USDC',
      recipients: RecipientLine[],
      opts?: { memo?: string; invoiceId?: string }
    ): SplitPaymentConfirmation => {
      const request: SplitPaymentRequest = {
        id: generateSplitPaymentId(),
        payerAddress,
        totalAmount,
        assetCode,
        recipients,
        memo: opts?.memo,
        invoiceId: opts?.invoiceId,
      };

      const confirmation = buildSplitConfirmation(request, ruleConfig);

      setState({
        status: 'confirmed',
        confirmation,
        result: null,
        isExecuting: false,
        error: null,
      });

      return confirmation;
    },
    [ruleConfig]
  );

  const confirmAndExecute = useCallback(async (): Promise<SplitPaymentResult | null> => {
    const confirmation = state.confirmation;
    if (!confirmation) {
      setState((prev) => ({
        ...prev,
        error: 'No split payment prepared. Call prepareSplit() first.',
      }));
      return null;
    }

    if (!confirmation.allRulesPassed) {
      setState((prev) => ({
        ...prev,
        error: 'Split payment rules not satisfied. Fix validation errors before executing.',
      }));
      return null;
    }

    if (!confirmation.validation.isValid) {
      setState((prev) => ({
        ...prev,
        error: confirmation.validation.errorMessage || 'Invalid split configuration',
      }));
      return null;
    }

    // Mark as confirmed
    const confirmedConfirmation: SplitPaymentConfirmation = {
      ...confirmation,
      userConfirmed: true,
      confirmedAt: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      status: 'executing',
      confirmation: confirmedConfirmation,
      isExecuting: true,
      error: null,
    }));

    try {
      const result = await executeSplitPayment(
        confirmation.request,
        executor,
        {
          maxRetries,
          onRecipientComplete,
          onStatusChange: (status) => {
            setState((prev) => ({ ...prev, status }));
          },
        }
      );

      setState({
        status: result.status,
        confirmation: confirmedConfirmation,
        result,
        isExecuting: false,
        error: result.error || null,
      });

      onComplete?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        status: 'failed',
        isExecuting: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [state.confirmation, executor, maxRetries, onRecipientComplete, onComplete]);

  const cancel = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      status: 'cancelled',
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    prepareSplit,
    confirmAndExecute,
    cancel,
    reset,
  };
}
