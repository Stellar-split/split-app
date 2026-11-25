"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUserPreferences, type FiatCurrency } from "@/context/UserPreferencesContext";

/** How often the rate is refreshed while the app is open. */
export const RATE_REFRESH_MS = 60_000;

type RatesByCurrency = Partial<Record<Lowercase<FiatCurrency>, number>>;

interface RateState {
  rates: RatesByCurrency | null;
  loading: boolean;
  /** Set when the last fetch failed and no usable rate is available. */
  error: string | null;
  /** Timestamp (ms) of the last successful fetch, used to derive `isStale`. */
  lastFetchedAt: number | null;
}

interface FiatRateContextValue extends RateState {
  /** Rate for the user's selected currency, or null when unavailable. */
  rate: number | null;
  currency: FiatCurrency;
  /** Full map of available fiat rates keyed by lowercase currency code. */
  ratesByCurrency: RatesByCurrency | null;
  /** Force an immediate refetch of all rates. */
  refresh: () => void;
  /** Subscribe to successful rate updates; returns an unsubscribe function. */
  subscribe: (listener: (rates: RatesByCurrency, fetchedAt: number) => void) => () => void;
}

const DEFAULT_TTL_SECONDS = 60;

const FiatRateContext = createContext<FiatRateContextValue | null>(null);

/**
 * Fetches the invoice asset's fiat price and refreshes it on an interval.
 *
 * A failed refresh clears the previous rate rather than leaving a stale number
 * on screen — consumers render "Rate unavailable" instead.
 */
export function FiatRateProvider({ children }: { children: React.ReactNode }) {
  const { fiatCurrency } = useUserPreferences();
  const [state, setState] = useState<RateState>({
    rates: null,
    loading: true,
    error: null,
    lastFetchedAt: null,
  });
  const mounted = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const listeners = useRef(new Set<(rates: RatesByCurrency, fetchedAt: number) => void>());

  const load = useMemo(() => {
    return async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const res = await fetch("/api/rates", { signal: controller.signal });
        if (!res.ok) throw new Error(`Rate request failed (${res.status})`);

        const body = (await res.json()) as { rates?: RatesByCurrency };
        if (!body.rates) throw new Error("Malformed rate response");

        if (mounted.current && !controller.signal.aborted) {
          const fetchedAt = Date.now();
          setState({ rates: body.rates, loading: false, error: null, lastFetchedAt: fetchedAt });
          listeners.current.forEach((listener) => {
            try {
              listener(body.rates as RatesByCurrency, fetchedAt);
            } catch {
              // A misbehaving subscriber must not break rate propagation.
            }
          });
        }
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ rates: null, loading: false, error: message, lastFetchedAt: prev.lastFetchedAt }));
      }
    };
  }, []);

  useEffect(() => {
    mounted.current = true;

    load();
    const timer = setInterval(load, RATE_REFRESH_MS);

    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
      clearInterval(timer);
    };
  }, [load]);

  const refresh = useMemo(() => () => void load(), [load]);

  const subscribe = useMemo(
    () => (listener: (rates: RatesByCurrency, fetchedAt: number) => void) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    [],
  );

  const value = useMemo<FiatRateContextValue>(() => {
    const key = fiatCurrency.toLowerCase() as Lowercase<FiatCurrency>;
    const rate = state.rates?.[key] ?? null;
    return {
      ...state,
      rate,
      currency: fiatCurrency,
      ratesByCurrency: state.rates,
      refresh,
      subscribe,
      // A response that omits the selected currency is as unusable as no response.
      error: state.error ?? (!state.loading && rate === null ? "Rate unavailable" : null),
    };
  }, [state, fiatCurrency, refresh, subscribe]);

  return createElement(FiatRateContext.Provider, { value }, children);
}

/**
 * Read the current fiat rate for the user's preferred currency.
 *
 * `ttl` (seconds, default 60) controls how long the cached rate is considered
 * fresh; once exceeded, `isStale` is true while the last-known rate is still
 * returned. Returns a neutral loading state outside a provider so a component
 * tree that has not mounted the provider degrades instead of throwing.
 */
export function useFiatRate(ttl: number = DEFAULT_TTL_SECONDS): FiatRateContextValue & { isStale: boolean } {
  const ctx = useContext(FiatRateContext);
  if (!ctx) {
    return {
      rates: null,
      rate: null,
      loading: false,
      error: "Rate unavailable",
      currency: "USD",
      lastFetchedAt: null,
      isStale: false,
      ratesByCurrency: null,
      refresh: () => {},
      subscribe: () => () => {},
    };
  }
  const isStale = ctx.lastFetchedAt !== null && Date.now() - ctx.lastFetchedAt > ttl * 1000;
  return { ...ctx, isStale };
}

export default useFiatRate;
