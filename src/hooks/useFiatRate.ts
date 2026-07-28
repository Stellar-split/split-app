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
}

interface FiatRateContextValue extends RateState {
  /** Rate for the user's selected currency, or null when unavailable. */
  rate: number | null;
  currency: FiatCurrency;
}

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
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch("/api/rates", { signal: controller.signal });
        if (!res.ok) throw new Error(`Rate request failed (${res.status})`);

        const body = (await res.json()) as { rates?: RatesByCurrency };
        if (!body.rates) throw new Error("Malformed rate response");

        if (mounted.current) {
          setState({ rates: body.rates, loading: false, error: null });
        }
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ rates: null, loading: false, error: message });
      }
    };

    load();
    const timer = setInterval(load, RATE_REFRESH_MS);

    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const value = useMemo<FiatRateContextValue>(() => {
    const key = fiatCurrency.toLowerCase() as Lowercase<FiatCurrency>;
    const rate = state.rates?.[key] ?? null;
    return {
      ...state,
      rate,
      currency: fiatCurrency,
      // A response that omits the selected currency is as unusable as no response.
      error: state.error ?? (!state.loading && rate === null ? "Rate unavailable" : null),
    };
  }, [state, fiatCurrency]);

  return createElement(FiatRateContext.Provider, { value }, children);
}

/**
 * Read the current fiat rate for the user's preferred currency.
 *
 * Returns a neutral loading state outside a provider so a component tree that
 * has not mounted the provider degrades instead of throwing.
 */
export function useFiatRate(): FiatRateContextValue {
  const ctx = useContext(FiatRateContext);
  if (!ctx) {
    return { rates: null, rate: null, loading: false, error: "Rate unavailable", currency: "USD" };
  }
  return ctx;
}

export default useFiatRate;
