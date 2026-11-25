"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Rolling windows tracked by the velocity gauge. */
export type VelocityWindow = "1h" | "24h" | "7d";

export const VELOCITY_WINDOWS: VelocityWindow[] = ["1h", "24h", "7d"];

const WINDOW_MS: Record<VelocityWindow, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** localStorage key for user-configured thresholds. */
export const VELOCITY_THRESHOLDS_KEY = "stellarsplit:velocityThresholds";

/** Default per-window thresholds (USDC). */
export const DEFAULT_THRESHOLDS: Record<VelocityWindow, number> = {
  "1h": 1000,
  "24h": 10000,
  "7d": 50000,
};

/** How often velocity data is re-fetched. */
export const VELOCITY_POLL_MS = 30_000;

export interface VelocityStat {
  volume: number;
  threshold: number;
}

export interface PaymentVelocityAlert {
  window: VelocityWindow;
  volume: number;
  threshold: number;
}

export interface UsePaymentVelocityResult {
  velocities: Record<VelocityWindow, VelocityStat> | undefined;
  lastUpdated: Date | undefined;
  loading: boolean;
  error: Error | null;
  /** Current thresholds (from localStorage, else defaults). */
  thresholds: Record<VelocityWindow, number>;
  /** Persist a new threshold for one window. */
  setThreshold: (window: VelocityWindow, value: number) => void;
  /** Refetch immediately. */
  refresh: () => void;
}

interface HorizonPaymentRecord {
  type?: string;
  from?: string;
  amount?: string;
  created_at?: string;
}

function readThresholds(): Record<VelocityWindow, number> {
  if (typeof window === "undefined") return { ...DEFAULT_THRESHOLDS };
  try {
    const raw = window.localStorage.getItem(VELOCITY_THRESHOLDS_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    const parsed = JSON.parse(raw) as Partial<Record<VelocityWindow, number>>;
    return {
      "1h": typeof parsed["1h"] === "number" ? parsed["1h"] : DEFAULT_THRESHOLDS["1h"],
      "24h": typeof parsed["24h"] === "number" ? parsed["24h"] : DEFAULT_THRESHOLDS["24h"],
      "7d": typeof parsed["7d"] === "number" ? parsed["7d"] : DEFAULT_THRESHOLDS["7d"],
    };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

async function fetchOutgoingPayments(account: string): Promise<HorizonPaymentRecord[]> {
  const sdk: any = await import("@stellar/stellar-sdk");
  const ServerCtor = sdk.Server ?? sdk.Horizon?.Server;
  const server = new ServerCtor(HORIZON_URL);
  const page = await server
    .payments()
    .forAccount(account)
    .order("desc")
    .limit(200)
    .call();
  const records: HorizonPaymentRecord[] = page?.records ?? [];
  // Outgoing payment operations only, in USDC-equivalent units.
  return records.filter((r) => r.type === "payment" && r.from === account);
}

function computeVelocities(
  records: HorizonPaymentRecord[],
  thresholds: Record<VelocityWindow, number>,
  now = Date.now(),
): Record<VelocityWindow, VelocityStat> {
  const parsed = records
    .map((r) => ({
      amount: Number(r.amount ?? 0),
      time: r.created_at ? new Date(r.created_at).getTime() : NaN,
    }))
    .filter((p) => Number.isFinite(p.amount) && Number.isFinite(p.time));

  const sum = (window: VelocityWindow) =>
    parsed
      .filter((p) => p.time > now - WINDOW_MS[window])
      .reduce((acc, p) => acc + p.amount, 0);

  return {
    "1h": { volume: sum("1h"), threshold: thresholds["1h"] },
    "24h": { volume: sum("24h"), threshold: thresholds["24h"] },
    "7d": { volume: sum("7d"), threshold: thresholds["7d"] },
  };
}

/**
 * usePaymentVelocity (#408) — tracks outgoing payment volume over rolling
 * 1h / 24h / 7d windows against configurable thresholds, refreshing every
 * 30 seconds. Dispatches a `velocity:alert` CustomEvent whenever a window's
 * volume crosses its threshold.
 */
export function usePaymentVelocity(account?: string | null): UsePaymentVelocityResult {
  const [thresholds, setThresholds] = useState<Record<VelocityWindow, number>>(readThresholds);
  const [velocities, setVelocities] = useState<Record<VelocityWindow, VelocityStat> | undefined>(
    undefined,
  );
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const alertStateRef = useRef<Record<VelocityWindow, boolean>>({
    "1h": false,
    "24h": false,
    "7d": false,
  });

  const refresh = useCallback(async () => {
    if (!account) {
      if (mountedRef.current) {
        setVelocities(computeVelocities([], thresholds));
        setLastUpdated(new Date());
        setError(null);
        setLoading(false);
      }
      return;
    }
    try {
      const records = await fetchOutgoingPayments(account);
      if (!mountedRef.current) return;
      const next = computeVelocities(records, thresholds);
      setVelocities(next);
      setLastUpdated(new Date());
      setError(null);

      // Fire alert events on threshold crossings (rising edge per window).
      for (const window of VELOCITY_WINDOWS) {
        const stat = next[window];
        const breached = stat.volume > stat.threshold;
        if (breached && !alertStateRef.current[window] && typeof globalThis.dispatchEvent === "function") {
          globalThis.dispatchEvent(
            new CustomEvent<PaymentVelocityAlert>("velocity:alert", {
              detail: { window, volume: stat.volume, threshold: stat.threshold },
            }),
          );
        }
        alertStateRef.current[window] = breached;
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [account, thresholds]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, VELOCITY_POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  const setThreshold = useCallback((window: VelocityWindow, value: number) => {
    setThresholds((prev) => {
      const next = { ...prev, [window]: value };
      try {
        if (typeof globalThis.localStorage !== "undefined") {
          globalThis.localStorage.setItem(VELOCITY_THRESHOLDS_KEY, JSON.stringify(next));
        }
      } catch {
        // storage unavailable — thresholds just won't persist
      }
      return next;
    });
  }, []);

  return useMemo(
    () => ({ velocities, lastUpdated, loading, error, thresholds, setThreshold, refresh }),
    [velocities, lastUpdated, loading, error, thresholds, setThreshold, refresh],
  );
}

export default usePaymentVelocity;
