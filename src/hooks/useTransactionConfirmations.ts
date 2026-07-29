"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export const FINALITY_THRESHOLD = 3;
const POLL_INTERVAL_MS = 5_000;

export interface TransactionConfirmationsState {
  confirmations: number;
  confirmed: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Polls /api/tx/[hash] every 5 seconds to track Stellar ledger confirmations.
 * Pauses polling when the browser tab is hidden (Page Visibility API).
 * Stops automatically once FINALITY_THRESHOLD confirmations are reached.
 */
export function useTransactionConfirmations(
  txHash: string | null | undefined
): TransactionConfirmationsState {
  const [state, setState] = useState<TransactionConfirmationsState>({
    confirmations: 0,
    confirmed: false,
    loading: false,
    error: null,
  });

  const stopPolling = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!txHash || stopPolling.current || document.hidden) return;

    try {
      const res = await fetch(`/api/tx/${txHash}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? "Fetch error" }));
        return;
      }
      const data: { confirmations: number; confirmed: boolean } = await res.json();
      setState({
        confirmations: data.confirmations,
        confirmed: data.confirmed,
        loading: false,
        error: null,
      });
      if (data.confirmed) {
        stopPolling.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: "Network error" }));
    }
  }, [txHash]);

  useEffect(() => {
    if (!txHash) return;

    stopPolling.current = false;
    setState({ confirmations: 0, confirmed: false, loading: true, error: null });

    // Initial fetch
    poll();

    // Set up polling interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Pause/resume on visibility change
    const handleVisibility = () => {
      if (!document.hidden && !stopPolling.current) {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [txHash, poll]);

  return state;
}
