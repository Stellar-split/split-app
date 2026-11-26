"use client";

import { useState, useCallback } from "react";
import { simulateTransaction, SimulationResult } from "@/lib/simulateTx";
import { retryWithBackoff } from "@/lib/retryWithBackoff";
import { toAppError } from "@/lib/appError";
import { useToast } from "@/context/ToastContext";

/** Minimal rate lock shape needed to detect expiry. */
export interface PaymentRateLock {
  currency?: string;
  rate?: number;
  /** Epoch ms when the lock expires. */
  expiresAt: number;
}

/** Options accepted when initiating a payment. */
export interface InitiatePaymentOptions {
  rateLock?: PaymentRateLock | null;
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
    onConfirm: () => Promise<unknown>,
    onCancel: () => void,
    options?: InitiatePaymentOptions
  ) => Promise<void>;
  resetState: () => void;
}

const INITIAL_STATE: PaymentSubmissionState = {
  showSimulationPreview: false,
  isSimulating: false,
  simulationResult: null,
  simulationError: null,
  rateLockExpired: false,
};

/**
 * Returns true when the given rate lock is missing or has expired.
 * A lock is considered expired at or after its `expiresAt` timestamp.
 */
export function isRateLockExpired(
  lock: PaymentRateLock | null | undefined,
  now: number = Date.now()
): boolean {
  if (!lock || typeof lock.expiresAt !== "number") return false;
  return now >= lock.expiresAt;
}

export function usePaymentSubmission(): UsePaymentSubmissionReturn {
  const [state, setState] = useState<PaymentSubmissionState>(INITIAL_STATE);
  const { notify } = useToast();

  const initiateDemoPayment = useCallback(
    async (
      transactionXdr: string,
      onConfirm: () => Promise<unknown>,
      onCancel: () => void,
      options?: InitiatePaymentOptions
    ) => {
      if (isRateLockExpired(options?.rateLock)) {
        setState((prev) => ({
          ...prev,
          showSimulationPreview: false,
          isSimulating: false,
          simulationResult: null,
          simulationError: "Rate lock has expired. Please refresh the rate and try again.",
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
        const result = await retryWithBackoff(
          () => simulateTransaction(transactionXdr),
          {
            onRetry: (attempt, error) => {
              notify({
                type: "info",
                message: `Simulation failed (${
                  toAppError(error).message
                }). Retrying attempt ${attempt}...`,
              });
            },
          }
        );
        if (!result.success && result.error) {
          setState((prev) => ({
            ...prev,
            isSimulating: false,
            simulationError: result.error ?? "Simulation failed",
            simulationResult: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isSimulating: false,
            simulationResult: result,
          }));
        }
      } catch (error) {
        const appError = toAppError(error);
        setState((prev) => ({
          ...prev,
          isSimulating: false,
          simulationError: appError.message,
          simulationResult: null,
        }));
      }
    },
    [notify]
  );

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { state, initiateDemoPayment, resetState };
}
