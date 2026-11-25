"use client";

import { useState, useCallback } from "react";
import { simulateTransaction, SimulationResult } from "@/lib/simulateTx";
import { retryWithBackoff } from "@/lib/retryWithBackoff";
import { toAppError } from "@/lib/appError";
import { useToast } from "@/context/ToastContext";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

interface PaymentSubmissionState {
  showSimulationPreview: boolean;
  isSimulating: boolean;
  simulationResult: SimulationResult | null;
  simulationError: string | null;
}

interface UsePaymentSubmissionReturn {
  state: PaymentSubmissionState;
  initiateDemoPayment: (
    transactionXdr: string,
    onConfirm: () => Promise<unknown>,
    onCancel: () => void
  ) => Promise<void>;
  resetState: () => void;
}

const INITIAL_STATE: PaymentSubmissionState = {
  showSimulationPreview: false,
  isSimulating: false,
  simulationResult: null,
  simulationError: null,
};

export function usePaymentSubmission(): UsePaymentSubmissionReturn {
  const [state, setState] = useState<PaymentSubmissionState>(INITIAL_STATE);

  const { notify } = useToast();
  const { enqueue } = useOfflineQueue();

  const initiateDemoPayment = useCallback(
    async (
      transactionXdr: string,
      onConfirm: () => Promise<unknown>,
      onCancel: () => void
    ) => {
      setState((prev) => ({
        ...prev,
        showSimulationPreview: true,
        isSimulating: true,
        simulationError: null,
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
