export type Locale = "en" | "es" | "fr";

const translations: Record<Locale, Record<string, string>> = {
  en: {
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
  fr: {
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
};

export function t(locale: Locale, key: string): string {
  return translations[locale]?.[key] ?? key;
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
