import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import ptMessages from "@/messages/pt.json";
import frMessages from "@/messages/fr.json";

export type Locale = "en" | "es" | "pt" | "fr";

const messages: Record<Locale, any> = {
  en: enMessages,
  es: esMessages,
  pt: ptMessages,
  fr: frMessages,
};

export function getMessages(locale: Locale) {
  return messages[locale] || messages.en;
}

export function t(locale: Locale, key: string): string {
  const keys = key.split(".");
  let value: any = getMessages(locale);

  for (const k of keys) {
    if (value && typeof value === "object") {
      value = value[k];
    } else {
      return key;
    }
  }

  return typeof value === "string" ? value : key;
}
