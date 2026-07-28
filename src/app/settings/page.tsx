"use client";

import {
  FIAT_CURRENCIES,
  useUserPreferences,
  type FiatCurrency,
} from "@/context/UserPreferencesContext";
import { useFiatRate } from "@/hooks/useFiatRate";

const CURRENCY_LABELS: Record<FiatCurrency, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  BRL: "Brazilian Real",
};

export default function SettingsPage() {
  const { fiatCurrency, setFiatCurrency } = useUserPreferences();
  const { rate, loading, error } = useFiatRate();

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <section aria-labelledby="currency-heading" className="mb-10">
        <h2 id="currency-heading" className="text-lg font-semibold mb-1">
          Display currency
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Invoice amounts show a fiat equivalent in this currency. The rate refreshes
          every 60 seconds.
        </p>

        <label htmlFor="fiat-currency" className="block text-sm font-medium text-gray-300 mb-1">
          Preferred fiat currency
        </label>
        <select
          id="fiat-currency"
          value={fiatCurrency}
          onChange={(e) => setFiatCurrency(e.target.value as FiatCurrency)}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {FIAT_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code} — {CURRENCY_LABELS[code]}
            </option>
          ))}
        </select>

        <p className="mt-3 text-xs text-gray-500" aria-live="polite">
          {loading
            ? "Loading current rate…"
            : error || rate === null
            ? "Rate unavailable"
            : `Current rate: 1 USDC ≈ ${rate} ${fiatCurrency}`}
        </p>
      </section>

      <section aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-lg font-semibold mb-3">
          More settings
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <a href="/settings/accessibility" className="text-indigo-400 hover:text-indigo-300">
              Accessibility
            </a>
          </li>
          <li>
            <a href="/settings/notifications" className="text-indigo-400 hover:text-indigo-300">
              Notifications
            </a>
          </li>
          <li>
            <a href="/settings/api-keys" className="text-indigo-400 hover:text-indigo-300">
              API keys
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
