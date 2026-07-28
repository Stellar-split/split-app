"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18nTypes";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import ptMessages from "@/messages/pt.json";
import frMessages from "@/messages/fr.json";

const messages: Record<Locale, any> = {
  en: enMessages,
  es: esMessages,
  pt: ptMessages,
  fr: frMessages,
};

const LOCALE_KEY = "split-locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(LOCALE_KEY) || "en") as Locale;
    const valid: Locale[] = ["en", "es", "pt", "fr"];
    const resolved: Locale = valid.includes(saved) ? saved : "en";
    setLocaleState(resolved);
    document.documentElement.lang = resolved;
    // RTL scaffold: set dir attribute (Arabic/Hebrew future support)
    document.documentElement.dir = "ltr";
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    localStorage.setItem(LOCALE_KEY, newLocale);
    setLocaleState(newLocale);
    document.documentElement.lang = newLocale;
    // RTL scaffold — extend here when adding ar/he
    document.documentElement.dir = "ltr";
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
    return {
      locale: "en" as Locale,
      setLocale: (_: Locale) => {},
      t: (key: string) => key,
    };
  }
  return context;
}
