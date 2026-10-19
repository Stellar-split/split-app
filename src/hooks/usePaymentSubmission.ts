"use client";

import { useState, useCallback } from "react";
import { simulateTransaction, SimulationResult } from "@/lib/simulateTx";

export interface RateLock {
  /** Currency code the rate was locked for (e.g. "USD"). */
  currency: string;
  /** Locked exchange rate (currency units per XLM). */
  rate: number;
  /** Epoch milliseconds after which the lock is no longer valid. */
  expiresAt: number;
}

export interface BundleContext {
  bundleId: string;
  /** Invoice ids included in the bundle being paid. */
  invoiceIds: string[];
}

export interface CurrencyHistoryEntry {
  currency: string;
  rate: number;
  amount: number;
  bundleId?: string;
  recordedAt: number;
}

export interface PaymentSubmissionOptions {
  rateLock?: RateLock | null;
  bundle?: BundleContext | null;
  /** Amount being paid, used for currency history tracking. */
  amount?: number;
}

interface PaymentSubmissionState {
  showSimulationPreview: boolean;
  isSimulating: boolean;
  simulationResult: SimulationResult | null;
  simulationError: string | null;
  rateLockExpired: boolean;
}

interface UsePaymentSubmissionReturn {
  state: PaymentSubmissionState;
  initiateDemoPayment: (
    transactionXdr: string,
    onConfirm: () => Promise<any>,
    onCancel: () => void,
    options?: PaymentSubmissionOptions
  ) => Promise<void>;
  resetState: () => void;
}

export function isRateLockExpired(
  rateLock: RateLock | null | undefined,
  now: number = Date.now()
): boolean {
  if (!rateLock) return false;
  return now >= rateLock.expiresAt;
}

export function usePaymentSubmission(): UsePaymentSubmissionReturn {
  const [state, setState] = useState<PaymentSubmissionState>({
    showSimulationPreview: false,
    isSimulating: false,
    simulationResult: null,
    simulationError: null,
    rateLockExpired: false,
  });

  const initiateDemoPayment = useCallback(
    async (
      transactionXdr: string,
      onConfirm: () => Promise<any>,
      onCancel: () => void,
      options?: PaymentSubmissionOptions
    ) => {
      if (isRateLockExpired(options?.rateLock)) {
        setState((prev) => ({
          ...prev,
          showSimulationPreview: false,
          isSimulating: false,
          simulationResult: null,
          simulationError:
            "The exchange rate lock for this payment has expired. Please refresh the rate and try again.",
          rateLockExpired: true,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        showSimulationPreview: true,
        isSimulating: true,
        simulationError: null,
        rateLockExpired: false,
      }));

      try {
        const result = await simulateTransaction(transactionXdr);
        setState((prev) => ({
          ...prev,
          isSimulating: false,
          simulationResult: result,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to simulate transaction";
        setState((prev) => ({
          ...prev,
          isSimulating: false,
          simulationError: errorMessage,
        }));
      }
    },
    []
  );

  const handleProceed = useCallback(
    async (
      onConfirm: () => Promise<any>,
      options?: PaymentSubmissionOptions
    ) => {
      if (isRateLockExpired(options?.rateLock)) {
        setState((prev) => ({
          ...prev,
          simulationError:
            "The exchange rate lock for this payment has expired. Please refresh the rate and try again.",
          rateLockExpired: true,
        }));
        return;
      }

      try {
        await onConfirm();
        recordPaymentSideEffects(options);
        resetState();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Payment failed";
        setState((prev) => ({
          ...prev,
          simulationError: errorMessage,
        }));
      }
    },
    []
  );

  const handleCancel = useCallback((onCancel: () => void) => {
    onCancel();
    resetState();
  }, []);

  const handleSkip = useCallback(
    async (
      onConfirm: () => Promise<any>,
      options?: PaymentSubmissionOptions
    ) => {
      if (isRateLockExpired(options?.rateLock)) {
        setState((prev) => ({
          ...prev,
          simulationError:
            "The exchange rate lock for this payment has expired. Please refresh the rate and try again.",
          rateLockExpired: true,
        }));
        return;
      }

      try {
        await onConfirm();
        recordPaymentSideEffects(options);
        resetState();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Payment failed";
        setState((prev) => ({
          ...prev,
          simulationError: errorMessage,
        }));
      }
    },
    []
  );

  const resetState = useCallback(() => {
    setState({
      showSimulationPreview: false,
      isSimulating: false,
      simulationResult: null,
      simulationError: null,
      rateLockExpired: false,
    });
  }, []);

  return {
    state,
    initiateDemoPayment,
    resetState,
  };
}

/**
 * Records post-payment side effects: marks the bundle as paid and appends a
 * currency history entry when a rate lock was used. Failures here must not
 * surface as payment errors, so they are swallowed after logging.
 */
function recordPaymentSideEffects(options?: PaymentSubmissionOptions): void {
  if (!options) return;

  const { bundle, rateLock, amount } = options;

  if (bundle) {
    try {
      markBundlePaid(bundle);
    } catch (error) {
      console.error("Failed to update bundle status after payment", error);
    }
  }

  if (rateLock) {
    const entry: CurrencyHistoryEntry = {
      currency: rateLock.currency,
      rate: rateLock.rate,
      amount: amount ?? 0,
      bundleId: bundle?.bundleId,
      recordedAt: Date.now(),
    };
    try {
      appendCurrencyHistory(entry);
    } catch (error) {
      console.error("Failed to record currency history entry", error);
    }
  }
}

function markBundlePaid(bundle: BundleContext): void {
  if (typeof window === "undefined") return;
  const key = `bundle-status:${bundle.bundleId}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      bundleId: bundle.bundleId,
      invoiceIds: bundle.invoiceIds,
      status: "paid",
      paidAt: Date.now(),
    })
  );
}

function appendCurrencyHistory(entry: CurrencyHistoryEntry): void {
  if (typeof window === "undefined") return;
  const key = "currency-history";
  const raw = window.localStorage.getItem(key);
  let history: CurrencyHistoryEntry[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed;
    } catch {
      history = [];
    }
  }
  history.push(entry);
  window.localStorage.setItem(key, JSON.stringify(history));
}
