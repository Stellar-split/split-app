"use client";

import { useState, useCallback } from "react";
import { simulateTransaction, SimulationResult } from "@/lib/simulateTx";

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
    onConfirm: () => Promise<any>,
    onCancel: () => void
  ) => Promise<void>;
  resetState: () => void;
}

export function usePaymentSubmission(): UsePaymentSubmissionReturn {
  const [state, setState] = useState<PaymentSubmissionState>({
    showSimulationPreview: false,
    isSimulating: false,
    simulationResult: null,
    simulationError: null,
  });

  const initiateDemoPayment = useCallback(
    async (
      transactionXdr: string,
      onConfirm: () => Promise<any>,
      onCancel: () => void
    ) => {
      setState((prev) => ({
        ...prev,
        showSimulationPreview: true,
        isSimulating: true,
        simulationError: null,
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
    async (onConfirm: () => Promise<any>) => {
      try {
        await onConfirm();
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
    async (onConfirm: () => Promise<any>) => {
      try {
        await onConfirm();
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
    });
  }, []);

  return {
    state,
    initiateDemoPayment,
    resetState,
  };
}
