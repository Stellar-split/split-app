"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "BRL"] as const;
export type FiatCurrency = (typeof FIAT_CURRENCIES)[number];

const STORAGE_KEY = "user-preferences";
const DEFAULT_CURRENCY: FiatCurrency = "USD";

export interface UserPreferences {
  fiatCurrency: FiatCurrency;
}

interface UserPreferencesContextValue extends UserPreferences {
  setFiatCurrency: (currency: FiatCurrency) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function isFiatCurrency(value: unknown): value is FiatCurrency {
  return typeof value === "string" && (FIAT_CURRENCIES as readonly string[]).includes(value);
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [fiatCurrency, setFiatCurrencyState] = useState<FiatCurrency>(DEFAULT_CURRENCY);

  // Read after mount rather than during render so server and client markup match.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<UserPreferences>;
      if (isFiatCurrency(parsed.fiatCurrency)) {
        setFiatCurrencyState(parsed.fiatCurrency);
      }
    } catch {
      // Corrupt or unavailable storage — fall back to the default.
    }
  }, []);

  const setFiatCurrency = useCallback((currency: FiatCurrency) => {
    setFiatCurrencyState(currency);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fiatCurrency: currency }));
    } catch {
      // Preference is still applied for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ fiatCurrency, setFiatCurrency }),
    [fiatCurrency, setFiatCurrency]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return ctx;
}

export default UserPreferencesProvider;
