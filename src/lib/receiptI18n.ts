import type { Locale as BaseLocale, Direction } from "./i18nTypes";

export type Locale = BaseLocale | "ar" | "he" | "fa" | "ur";

export interface LocaleTranslation {
  rtl: boolean;
  invoice: string;
  status: string;
  creator: string;
  deadline: string;
  total: string;
  recipients: string;
  address: string;
  amount: string;
  noDeadline: string;
  stellarSplitInvoice: string;
  [key: string]: string | boolean;
}

export const translations: Record<string, LocaleTranslation> = {
  en: {
    rtl: false,
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
  es: {
    rtl: false,
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
  pt: {
    rtl: false,
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
  fr: {
    rtl: false,
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
  ar: {
    rtl: true,
    invoice: "فاتورة",
    status: "الحالة",
    creator: "المنشئ",
    deadline: "الموعد النهائي",
    total: "المجموع",
    recipients: "المستلمون",
    address: "العنوان",
    amount: "المبلغ (USDC)",
    noDeadline: "بدون موعد نهائي",
    stellarSplitInvoice: "فاتورة StellarSplit على الشبكة",
  },
  he: {
    rtl: true,
    invoice: "חשבונית",
    status: "סטטוס",
    creator: "יוצר",
    deadline: "מועד אחרון",
    total: "סך הכל",
    recipients: "נמענים",
    address: "כתובת",
    amount: "סכום (USDC)",
    noDeadline: "אין מועד אחרון",
    stellarSplitInvoice: "חשבונית StellarSplit בבלוקצ'יין",
  },
  fa: {
    rtl: true,
    invoice: "فاکتور",
    status: "وضعیت",
    creator: "ایجادکننده",
    deadline: "مهلت",
    total: "مجموع",
    recipients: "دریافت‌کنندگان",
    address: "آدرس",
    amount: "مبلغ (USDC)",
    noDeadline: "بدون مهلت",
    stellarSplitInvoice: "فاکتور آن‌چین StellarSplit",
  },
  ur: {
    rtl: true,
    invoice: "رسید",
    status: "حیثیت",
    creator: "تخلیق کنندہ",
    deadline: "آخری تاریخ",
    total: "کل رقم",
    recipients: "وصول کنندگان",
    address: "پتہ",
    amount: "رقم (USDC)",
    noDeadline: "کوئی آخری تاریخ نہیں",
    stellarSplitInvoice: "اسٹیلر اسپلٹ آن چین رسید",
  },
};

const RTL_LOCALES = new Set([
  "ar", // Arabic
  "he", // Hebrew
  "fa", // Persian / Farsi
  "ur", // Urdu
  "yi", // Yiddish
  "ps", // Pashto
  "sd", // Sindhi
  "ug", // Uyghur
]);

/**
 * Returns true if the given locale code uses right-to-left text direction.
 * Checks against the translation metadata and known RTL language codes (ar, he, fa, ur, etc.).
 */
export function isRtl(locale: string): boolean {
  if (!locale) return false;
  const normalized = locale.trim().toLowerCase();
  const lang = normalized.split(/[-_]/)[0];

  if (translations[normalized]?.rtl === true || translations[lang]?.rtl === true) {
    return true;
  }

  return RTL_LOCALES.has(lang);
}

/**
 * Convenience helper returning "rtl" or "ltr" direction for a locale.
 */
export function getReceiptDirection(locale: string): Direction {
  return isRtl(locale) ? "rtl" : "ltr";
}

export function t(locale: Locale | string, key: string): string {
  const entry = translations[locale];
  if (!entry) return key;
  const val = entry[key];
  return typeof val === "string" ? val : key;
}

export function formatDate(date: Date, locale: Locale | string): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    pt: "pt-BR",
    fr: "fr-FR",
    ar: "ar-SA",
    he: "he-IL",
    fa: "fa-IR",
    ur: "ur-PK",
  };
  return new Intl.DateTimeFormat(localeMap[locale] || locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
