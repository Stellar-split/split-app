"use client";

import { useState, useEffect, useRef } from "react";

const REFRESH_MS = 60_000;

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
