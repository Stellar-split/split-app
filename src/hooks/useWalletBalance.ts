"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAccountBalances, type AccountBalance } from "@/lib/stellar/balances";
import { useInterval } from "@/hooks/useInterval";

export interface AssetBalance {
  asset: string;
  balance: string;
  formatted: string;
  isLow: boolean;
}

export interface BalanceHistoryEntry {
  timestamp: number;
  balances: Record<string, string>;
}

export interface LowBalanceWarning {
  asset: string;
  balance: string;
  threshold: string;
}

export interface UseWalletBalanceOptions {
  enabled?: boolean;
  /** Polling interval in milliseconds. Defaults to 30s. */
  pollIntervalMs?: number;
  /** Per-asset low balance thresholds, keyed by asset code (e.g. "XLM", "USDC"). */
  thresholds?: Record<string, string>;
  /** Maximum number of history entries to retain. Defaults to 50. */
  maxHistory?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const DEFAULT_POLL_INTERVAL_MS = 30000;
const DEFAULT_MAX_HISTORY = 50;
const HISTORY_STORAGE_PREFIX = "wallet-balance-history:";

function formatAmount(value: string, decimals: number = 7): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

function isBelowThreshold(balance: string, threshold: string): boolean {
  const b = Number(balance);
  const t = Number(threshold);
  if (!Number.isFinite(b) || !Number.isFinite(t)) return false;
  return b < t;
}

function loadHistory(address: string): BalanceHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_PREFIX + address);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(address: string, history: BalanceHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HISTORY_STORAGE_PREFIX + address,
      JSON.stringify(history)
    );
  } catch {
    // Ignore storage failures (quota, private mode, etc.)
  }
}

export function useWalletBalance(
  address: string | null,
  options: UseWalletBalanceOptions = {}
) {
  const {
    enabled = true,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    thresholds = {},
    maxHistory = DEFAULT_MAX_HISTORY,
  } = options;

  const [balances, setBalances] = useState<AccountBalance[] | null>(null);
  const [history, setHistory] = useState<BalanceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const addressRef = useRef<string | null>(address);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Load persisted history when the address changes.
  useEffect(() => {
    addressRef.current = address;
    if (!address) {
      setHistory([]);
      return;
    }
    setHistory(loadHistory(address));
  }, [address]);

  const fetchBalances = useCallback(async () => {
    const currentAddress = addressRef.current;
    if (!currentAddress) return;

    setIsLoading(true);
    try {
      const result = await fetchAccountBalances(currentAddress);
      if (!mountedRef.current) return;

      retryCountRef.current = 0;
      setIsRetrying(false);
      setError(undefined);
      setBalances(result);

      const snapshot: BalanceHistoryEntry = {
        timestamp: Date.now(),
        balances: result.reduce<Record<string, string>>((acc, b) => {
          acc[b.asset] = b.balance;
          return acc;
        }, {}),
      };

      setHistory(prev => {
        const next = [...prev, snapshot].slice(-maxHistory);
        saveHistory(currentAddress, next);
        return next;
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const normalized =
        err instanceof Error ? err : new Error("Failed to fetch wallet balances");

      if (retryCountRef.current >= MAX_RETRIES) {
        setIsRetrying(false);
        setError(normalized);
        return;
      }

      const delay = RETRY_DELAYS_MS[retryCountRef.current];
      retryCountRef.current += 1;
      setIsRetrying(true);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        void fetchBalances();
      }, delay);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [maxHistory]);

  // Initial fetch and refetch when the address changes.
  useEffect(() => {
    if (!enabled || !address) {
      setBalances(null);
      setError(undefined);
      setIsRetrying(false);
      retryCountRef.current = 0;
      return;
    }

    retryCountRef.current = 0;
    void fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, enabled]);

  // Poll for updates.
  useInterval(
    () => {
      void fetchBalances();
    },
    enabled && address ? pollIntervalMs : null
  );

  const assets: AssetBalance[] = useMemo(() => {
    if (!balances) return [];
    return balances.map(b => {
      const threshold = thresholds[b.asset];
      return {
        asset: b.asset,
        balance: b.balance,
        formatted: formatAmount(b.balance),
        isLow: threshold !== undefined && isBelowThreshold(b.balance, threshold),
      };
    });
  }, [balances, thresholds]);

  const warnings: LowBalanceWarning[] = useMemo(
    () =>
      assets
        .filter(a => a.isLow)
        .map(a => ({
          asset: a.asset,
          balance: a.balance,
          threshold: thresholds[a.asset],
        })),
    [assets, thresholds]
  );

  const findBalance = (asset: string): string | null =>
    assets.find(a => a.asset === asset)?.balance ?? null;

  const retriesExhausted = retryCountRef.current >= MAX_RETRIES;

  return {
    // Legacy fields preserved for existing consumers.
    xlmBalance: findBalance("XLM"),
    usdcBalance: findBalance("USDC"),
    // New fields.
    assets,
    balances,
    history,
    warnings,
    hasLowBalance: warnings.length > 0,
    isLoading,
    isRetrying,
    error: error && retriesExhausted ? error : undefined,
    refetch: fetchBalances,
  };
}
