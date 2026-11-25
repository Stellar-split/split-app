"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const REFRESH_MS = 60_000;

/** How long a rate lock remains valid for the payment window. */
export const RATE_LOCK_TTL_MS = 5 * 60_000;

const RATE_LOCK_STORAGE_KEY = "stellar:rate-locks";

/** Supported invoice currencies. */
export type InvoiceCurrency = "XLM" | "USDC" | "USD" | "EUR" | "GBP";

export const SUPPORTED_CURRENCIES: InvoiceCurrency[] = ["XLM", "USDC", "USD", "EUR", "GBP"];

/** A persisted rate lock captured at payment-preview time. */
export interface RateLock {
  currency: InvoiceCurrency;
  /** Amount expressed in the invoice currency. */
  amount: number;
  /** How many units of `currency` one XLM is worth at lock time. */
  rate: number;
  /** Equivalent amount in XLM at lock time. */
  xlmAmount: number;
  /** Epoch ms when the lock was created. */
  lockedAt: number;
  /** Epoch ms when the lock expires. */
  expiresAt: number;
}

export interface UseCurrencyRatesResult {
  /** Live rates keyed by currency: units of currency per 1 XLM. */
  rates: Partial<Record<InvoiceCurrency, number>>;
  /** True until the first successful fetch completes. */
  loading: boolean;
  /** Last fetch error message, if any. */
  error: string | null;
  /** Epoch ms of the last successful rate update. */
  updatedAt: number | null;
  /** Convert an XLM amount into the given currency at the current rate. */
  convertFromXlm: (amountXlm: number, currency: InvoiceCurrency) => number | null;
  /** Convert an amount in the given currency into XLM at the current rate. */
  convertToXlm: (amount: number, currency: InvoiceCurrency) => number | null;
  /** Capture and persist a rate lock for the payment window. */
  lockRate: (currency: InvoiceCurrency, amount: number) => RateLock | null;
  /** Retrieve a still-valid persisted lock for a currency, if any. */
  getActiveLock: (currency: InvoiceCurrency) => RateLock | null;
  /** Manually trigger a rate refresh. */
  refresh: () => Promise<void>;
}

function readLocks(): Record<string, RateLock> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RATE_LOCK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RateLock>) : {};
  } catch {
    return {};
  }
}

function writeLocks(locks: Record<string, RateLock>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATE_LOCK_STORAGE_KEY, JSON.stringify(locks));
  } catch {
    // Storage may be unavailable (private mode / quota) — locks are best-effort
  }
}

/**
 * useCurrencyRates
 *
 * Wraps the currency service to poll live exchange rates for all supported
 * invoice currencies (expressed as units per 1 XLM), exposes conversion
 * helpers, and provides persisted rate locks for the payment window.
 */
export function useCurrencyRates(): UseCurrencyRatesResult {
  const [rates, setRates] = useState<Partial<Record<InvoiceCurrency, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const ratesRef = useRef<Partial<Record<InvoiceCurrency, number>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd,eur,gbp",
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const stellar = data?.stellar ?? {};
      const xlmUsd: number | undefined = stellar.usd;
      if (typeof xlmUsd !== "number" || xlmUsd <= 0) {
        throw new Error("Invalid XLM rate");
      }

      const next: Partial<Record<InvoiceCurrency, number>> = {
        XLM: 1,
        USDC: xlmUsd, // USDC ≈ $1.00
        USD: xlmUsd,
      };
      if (typeof stellar.eur === "number" && stellar.eur > 0) next.EUR = stellar.eur;
      if (typeof stellar.gbp === "number" && stellar.gbp > 0) next.GBP = stellar.gbp;

      if (mounted.current) {
        ratesRef.current = next;
        setRates(next);
        setError(null);
        setUpdatedAt(Date.now());
        setLoading(false);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch rates");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const convertFromXlm = useCallback(
    (amountXlm: number, currency: InvoiceCurrency): number | null => {
      const rate = ratesRef.current[currency];
      if (typeof rate !== "number" || !Number.isFinite(amountXlm)) return null;
      return amountXlm * rate;
    },
    []
  );

  const convertToXlm = useCallback(
    (amount: number, currency: InvoiceCurrency): number | null => {
      const rate = ratesRef.current[currency];
      if (typeof rate !== "number" || rate <= 0 || !Number.isFinite(amount)) return null;
      return amount / rate;
    },
    []
  );

  const lockRate = useCallback(
    (currency: InvoiceCurrency, amount: number): RateLock | null => {
      const rate = ratesRef.current[currency];
      if (typeof rate !== "number" || rate <= 0 || !Number.isFinite(amount)) return null;
      const now = Date.now();
      const lock: RateLock = {
        currency,
        amount,
        rate,
        xlmAmount: amount / rate,
        lockedAt: now,
        expiresAt: now + RATE_LOCK_TTL_MS,
      };
      const locks = readLocks();
      locks[currency] = lock;
      writeLocks(locks);
      return lock;
    },
    []
  );

  const getActiveLock = useCallback((currency: InvoiceCurrency): RateLock | null => {
    const lock = readLocks()[currency];
    if (!lock) return null;
    if (Date.now() >= lock.expiresAt) return null;
    return lock;
  }, []);

  return {
    rates,
    loading,
    error,
    updatedAt,
    convertFromXlm,
    convertToXlm,
    lockRate,
    getActiveLock,
    refresh: load,
  };
}

export interface UseXlmUsdcRateOptions {
  /** Percentage move (e.g. 5 for 5%) from the rate at hook initialisation that triggers onAlert. */
  alertThreshold?: number;
  /** Called at most once per polling interval when the rate crosses alertThreshold. */
  onAlert?: (direction: "up" | "down", changePercent: number) => void;
}

/**
 * useXlmUsdcRate
 *
 * Returns the current XLM/USDC exchange rate (i.e. how many USDC one XLM is worth).
 * Polls CoinGecko's simple price API via the app's own rate proxy for XLM price in USD,
 * and since USDC ≈ 1 USD, uses xlmUsd as the XLM/USDC rate.
 *
 * Returns null while loading or when the rate is unavailable.
 */
export function useXlmUsdcRate(options?: UseXlmUsdcRateOptions): number | null {
  const [rate, setRate] = useState<number | null>(null);
  const mounted = useRef(true);
  const baseRateRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    mounted.current = true;
    baseRateRef.current = null;

    const load = async () => {
      try {
        // Fetch XLM price in USD from CoinGecko directly.
        // Since USDC ≈ $1.00, XLM/USDC ≈ XLM/USD.
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const xlmUsd: number | undefined = data?.stellar?.usd;
        if (typeof xlmUsd === "number" && xlmUsd > 0 && mounted.current) {
          if (baseRateRef.current === null) {
            baseRateRef.current = xlmUsd;
          } else {
            const { alertThreshold, onAlert } = optionsRef.current ?? {};
            if (alertThreshold && onAlert) {
              const changePercent = ((xlmUsd - baseRateRef.current) / baseRateRef.current) * 100;
              if (Math.abs(changePercent) >= alertThreshold) {
                onAlert(changePercent > 0 ? "up" : "down", Math.abs(changePercent));
              }
            }
          }
          setRate(xlmUsd);
        }
      } catch {
        // Leave rate unchanged on error — don't clear a valid cached rate
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  return rate;
}
