"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18nTypes";

const STORAGE_KEY = "split_app_locale";
const VALID_LOCALES: Locale[] = ["en", "es", "pt", "fr"];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && VALID_LOCALES.includes(stored) && stored !== locale) {
        setLocale(stored);
      }
    } catch {
      // localStorage unavailable; keep default locale
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as Locale;
    setLocale(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage unavailable; selection still applies for this session
    }
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="text-sm text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-900 border border-gray-800 transition-colors min-h-11 inline-flex items-center"
      aria-label="Select language"
    >
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="pt">Português</option>
      <option value="fr">Français</option>
    </select>
  );
}
