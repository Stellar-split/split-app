import { STELLARSPLIT_PREFIX, collectState } from "./stateSync";

export interface AccountDataExport {
  exportedAt: string;
  walletAddress: string;
  addressBook: unknown;
  templates: unknown;
  savedSearches: unknown;
  notificationSettings: unknown;
  customization: unknown;
  invoiceHistory: unknown[];
}

const SENSITIVE_PATTERNS = [
  /key/i,
  /secret/i,
  /token/i,
  /password/i,
  /api.?key/i,
];

export function redactValue(key: string, value: string): string {
  const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(key));
  if (!isSensitive) return value;
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

export function redactObject(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

function parseStoredJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function fetchInvoiceHistory(
  address: string,
  onProgress?: (loaded: number) => void,
): Promise<unknown[]> {
  const stored = parseStoredJson("stellarsplit_invoice_history");
  if (Array.isArray(stored)) {
    onProgress?.(stored.length);
    return stored;
  }
  onProgress?.(0);
  return [];
}

export async function generateExport(
  walletAddress: string,
  onProgress?: (step: string) => void,
): Promise<AccountDataExport> {
  onProgress?.("Collecting local data…");

  const addressBook = parseStoredJson("stellarsplit_address_book") ?? [];
  const templates = parseStoredJson("stellarsplit_templates") ?? [];
  const savedSearches = parseStoredJson("stellarsplit_saved_searches") ?? [];
  const notificationSettings = parseStoredJson("stellarsplit-notification-prefs") ?? {};
  const customization = parseStoredJson("stellarsplit_customization") ?? {};

  onProgress?.("Fetching invoice history…");
  const invoiceHistory = await fetchInvoiceHistory(walletAddress, (n) =>
    onProgress?.(`Loaded ${n} invoice records…`),
  );

  return {
    exportedAt: new Date().toISOString(),
    walletAddress,
    addressBook,
    templates,
    savedSearches,
    notificationSettings,
    customization,
    invoiceHistory,
  };
}

export function downloadExport(data: AccountDataExport): void {
  const raw = collectState();
  const redacted = redactObject(raw);

  const output = {
    ...data,
    _rawLocalStorage: redacted,
  };

  const json = JSON.stringify(output, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stellarsplit-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const EXPECTED_TOP_LEVEL_KEYS: (keyof AccountDataExport)[] = [
  "exportedAt",
  "walletAddress",
  "addressBook",
  "templates",
  "savedSearches",
  "notificationSettings",
  "customization",
  "invoiceHistory",
];
