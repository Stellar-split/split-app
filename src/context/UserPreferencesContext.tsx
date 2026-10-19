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

export const WALLET_TYPES = [
  "freighter",
  "lobstr",
  "xbull",
  "albedo",
  "rabet",
  "walletconnect",
] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

const STORAGE_KEY = "user-preferences";
const DEFAULT_CURRENCY: FiatCurrency = "USD";
const DEFAULT_AUTO_RECONNECT = true;

export interface UserPreferences {
  fiatCurrency: FiatCurrency;
  preferredWalletType?: WalletType;
  autoReconnect?: boolean;
}

interface UserPreferencesContextValue extends UserPreferences {
  setFiatCurrency: (currency: FiatCurrency) => void;
  setPreferredWalletType: (walletType: WalletType | undefined) => void;
  setAutoReconnect: (autoReconnect: boolean) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function isFiatCurrency(value: unknown): value is FiatCurrency {
  return typeof value === "string" && (FIAT_CURRENCIES as readonly string[]).includes(value);
}

function isWalletType(value: unknown): value is WalletType {
  return typeof value === "string" && (WALLET_TYPES as readonly string[]).includes(value);
}

function readStoredPreferences(): Partial<UserPreferences> {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<UserPreferences>;
  } catch {
    // Corrupt or unavailable storage — fall back to the defaults.
    return {};
  }
}

function writeStoredPreferences(preferences: UserPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preference is still applied for this session.
  }
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [fiatCurrency, setFiatCurrencyState] = useState<FiatCurrency>(DEFAULT_CURRENCY);
  const [preferredWalletType, setPreferredWalletTypeState] = useState<
    WalletType | undefined
  >(undefined);
  const [autoReconnect, setAutoReconnectState] = useState<boolean>(DEFAULT_AUTO_RECONNECT);

  // Read after mount rather than during render so server and client markup match.
  useEffect(() => {
    const parsed = readStoredPreferences();
    if (isFiatCurrency(parsed.fiatCurrency)) {
      setFiatCurrencyState(parsed.fiatCurrency);
    }
    if (isWalletType(parsed.preferredWalletType)) {
      setPreferredWalletTypeState(parsed.preferredWalletType);
    }
    if (typeof parsed.autoReconnect === "boolean") {
      setAutoReconnectState(parsed.autoReconnect);
    }
  }, []);

  const persist = useCallback(
    (overrides: Partial<UserPreferences>) => {
      writeStoredPreferences({
        ...readStoredPreferences(),
        fiatCurrency,
        preferredWalletType,
        autoReconnect,
        ...overrides,
      });
    },
    [fiatCurrency, preferredWalletType, autoReconnect]
  );

  const setFiatCurrency = useCallback(
    (currency: FiatCurrency) => {
      setFiatCurrencyState(currency);
      persist({ fiatCurrency: currency });
    },
    [persist]
  );

  const setPreferredWalletType = useCallback(
    (walletType: WalletType | undefined) => {
      setPreferredWalletTypeState(walletType);
      persist({ preferredWalletType: walletType });
    },
    [persist]
  );

  const setAutoReconnect = useCallback(
    (enabled: boolean) => {
      setAutoReconnectState(enabled);
      persist({ autoReconnect: enabled });
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      fiatCurrency,
      preferredWalletType,
      autoReconnect,
      setFiatCurrency,
      setPreferredWalletType,
      setAutoReconnect,
    }),
    [
      fiatCurrency,
      preferredWalletType,
      autoReconnect,
      setFiatCurrency,
      setPreferredWalletType,
      setAutoReconnect,
    ]
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
