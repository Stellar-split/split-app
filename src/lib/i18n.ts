const messages: Record<string, Record<string, any>> = {
  en: require("@/messages/en.json"),
  es: require("@/messages/es.json"),
};

export type Locale = "en" | "es";

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
