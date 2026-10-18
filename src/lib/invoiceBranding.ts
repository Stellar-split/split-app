"use client";

/**
 * Custom branding preferences for exported/printed invoices:
 * logo, accent color, font and an optional watermark override.
 * Persisted to localStorage per browser/user so preferences survive
 * reloads; exported PDFs and the on-screen preview both read from it.
 */

export interface InvoiceBranding {
  logoDataUrl: string | null;
  accentColor: string;
  fontFamily: string;
  watermarkEnabled: boolean;
  watermarkText: string;
}

export const DEFAULT_INVOICE_BRANDING: InvoiceBranding = {
  logoDataUrl: null,
  accentColor: "#4f46e5",
  fontFamily: "Inter, sans-serif",
  watermarkEnabled: true,
  watermarkText: "DRAFT",
};

export const INVOICE_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Inter (default)", value: "Inter, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Courier (monospace)", value: "'Courier New', monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const STORAGE_KEY = "invoice-branding";

function isValidHexColor(color: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
}

export function sanitizeBranding(input: Partial<InvoiceBranding>): InvoiceBranding {
  return {
    logoDataUrl:
      typeof input.logoDataUrl === "string" && input.logoDataUrl.startsWith("data:image/")
        ? input.logoDataUrl
        : null,
    accentColor:
      typeof input.accentColor === "string" && isValidHexColor(input.accentColor)
        ? input.accentColor
        : DEFAULT_INVOICE_BRANDING.accentColor,
    fontFamily:
      typeof input.fontFamily === "string" && input.fontFamily.trim()
        ? input.fontFamily
        : DEFAULT_INVOICE_BRANDING.fontFamily,
    watermarkEnabled:
      typeof input.watermarkEnabled === "boolean"
        ? input.watermarkEnabled
        : DEFAULT_INVOICE_BRANDING.watermarkEnabled,
    watermarkText:
      typeof input.watermarkText === "string" && input.watermarkText.trim()
        ? input.watermarkText.slice(0, 24)
        : DEFAULT_INVOICE_BRANDING.watermarkText,
  };
}

export function loadInvoiceBranding(): InvoiceBranding {
  if (typeof window === "undefined") return DEFAULT_INVOICE_BRANDING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INVOICE_BRANDING;
    return sanitizeBranding(JSON.parse(raw));
  } catch {
    return DEFAULT_INVOICE_BRANDING;
  }
}

export function saveInvoiceBranding(branding: InvoiceBranding): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeBranding(branding)));
  } catch {
    // Quota/private-mode failures: branding simply won't persist.
  }
}

/** Reads an uploaded logo File and resolves to a data URL, or null on failure/oversized file. */
export function readLogoFile(file: File, maxBytes = 1_500_000): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size > maxBytes) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
