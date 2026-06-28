"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18nTypes";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Import translations
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const messages: Record<Locale, any> = {
  en: enMessages,
  es: esMessages,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load saved locale from localStorage
    const saved = (localStorage.getItem("locale") || "en") as Locale;
    setLocaleState(saved);
    document.documentElement.lang = saved;
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    localStorage.setItem("locale", newLocale);
    setLocaleState(newLocale);
    document.documentElement.lang = newLocale;
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = messages[locale];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        return key;
      }
    }

    return typeof value === "string" ? value : key;
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // SSR fallback — return a no-op t function
    return {
      locale: "en" as Locale,
      setLocale: (_: Locale) => {},
      t: (key: string) => key,
    };
  }
  return context;
}
