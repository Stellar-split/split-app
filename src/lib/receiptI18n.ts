export type Locale = "en" | "es" | "pt" | "fr";

export interface LocaleMetadata {
  rtl: boolean;
  translations: Record<string, string>;
}

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: {
    rtl: false,
    translations: {
      invoice: "Invoice",
      status: "Status",
      creator: "Creator",
      deadline: "Deadline",
      total: "Total",
      recipients: "Recipients",
      address: "Address",
      amount: "Amount (USDC)",
      noDeadline: "No deadline",
      stellarSplitInvoice: "StellarSplit On-Chain Invoice",
    },
  },
  es: {
    rtl: false,
    translations: {
      invoice: "Factura",
      status: "Estado",
      creator: "Creador",
      deadline: "Fecha límite",
      total: "Total",
      recipients: "Destinatarios",
      address: "Dirección",
      amount: "Cantidad (USDC)",
      noDeadline: "Sin fecha límite",
      stellarSplitInvoice: "Factura StellarSplit En Cadena",
    },
  },
  pt: {
    rtl: false,
    translations: {
      invoice: "Fatura",
      status: "Status",
      creator: "Criador",
      deadline: "Prazo",
      total: "Total",
      recipients: "Destinatários",
      address: "Endereço",
      amount: "Valor (USDC)",
      noDeadline: "Sem prazo",
      stellarSplitInvoice: "Fatura StellarSplit On-Chain",
    },
  },
  fr: {
    rtl: false,
    translations: {
      invoice: "Facture",
      status: "Statut",
      creator: "Créateur",
      deadline: "Échéance",
      total: "Total",
      recipients: "Destinataires",
      address: "Adresse",
      amount: "Montant (USDC)",
      noDeadline: "Pas d'échéance",
      stellarSplitInvoice: "Facture StellarSplit En Chaîne",
    },
  },
};

export function t(locale: Locale, key: string): string {
  return localeMetadata[locale]?.translations[key] ?? key;
}

const rtlLanguageCodes = new Set([
  "ar",
  "arc",
  "dv",
  "fa",
  "ha",
  "he",
  "khw",
  "ks",
  "ku",
  "ps",
  "sd",
  "syr",
  "ug",
  "ur",
  "yi",
]);

export function isRtl(locale: string): boolean {
  const languageCode = locale.trim().toLowerCase().split(/[-_]/, 1)[0];
  return rtlLanguageCodes.has(languageCode);
}

export function formatDate(date: Date, locale: Locale): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
    pt: "pt-BR",
    fr: "fr-FR",
  };
  return new Intl.DateTimeFormat(localeMap[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
