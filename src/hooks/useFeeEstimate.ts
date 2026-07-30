"use client";

import { useEffect, useRef, useState } from "react";

/** Stellar network base fee used when fee stats cannot be loaded (stroops). */
export const FALLBACK_BASE_FEE = 100;

/** How often fee stats are refreshed while the hook is mounted. */
export const FEE_POLL_MS = 10_000;

export interface UseFeeEstimateResult {
  /** Current ledger base fee, in stroops. */
  baseFee?: number;
  /** Median accepted fee (feeCharged.mode / modeAcceptanceRate), in stroops. */
  medianFee?: number;
  /** 90th percentile accepted fee, in stroops. */
  p90Fee?: number;
  loading: boolean;
  error: string | null;
}

interface ParsedFeeStats {
  baseFee: number;
  medianFee: number;
  p90Fee: number;
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalizes both Horizon fee-stats shapes:
 *   legacy: { baseFee, modeAcceptanceRate, p10..p99AcceptanceRate }
 *   modern: { lastLedgerBaseFee, feeCharged: { mode, p10..p99 } }
 */
export function parseFeeStats(stats: {
  baseFee?: string | number;
  lastLedgerBaseFee?: string | number;
  modeAcceptanceRate?: string | number;
  p90AcceptanceRate?: string | number;
  feeCharged?: { mode?: string | number; p90?: string | number };
} | null | undefined): ParsedFeeStats {
  const baseFee = toNumber(stats?.lastLedgerBaseFee ?? stats?.baseFee, FALLBACK_BASE_FEE);
  const medianFee = toNumber(
    stats?.feeCharged?.mode ?? stats?.modeAcceptanceRate,
    baseFee,
  );
  const p90Fee = toNumber(
    stats?.feeCharged?.p90 ?? stats?.p90AcceptanceRate,
    medianFee,
  );
  return { baseFee, medianFee, p90Fee };
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

/**
 * Polls Horizon fee stats and exposes economy/standard/priority fee anchors.
 *
 * Always returns values in stroops; falls back to the 100-stroop base fee
 * when the network is unreachable.
 */
export function useFeeEstimate(): UseFeeEstimateResult {
  const [state, setState] = useState<{
    baseFee?: number;
    medianFee?: number;
    p90Fee?: number;
    error: string | null;
  }>({ error: null });
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchStats = async () => {
      try {
        // Horizon.Server is available from the top-level SDK export; access
        // dynamically so environments without Horizon URLs degrade to the
        // fallback fee instead of failing to bundle.
        const sdk: any = await import("@stellar/stellar-sdk");
        const ServerCtor = sdk.Server ?? sdk.Horizon?.Server;
        const server = new ServerCtor(HORIZON_URL);
        const stats = await server.feeStats();
        if (!mountedRef.current) return;
        const parsed = parseFeeStats(stats ?? null);
        setState({ ...parsed, error: null });
      } catch (err) {
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, FEE_POLL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return {
    baseFee: state.baseFee,
    medianFee: state.medianFee,
    p90Fee: state.p90Fee,
    loading,
    error: state.error,
  };
}

export default useFeeEstimate;
