import {
  BrandSettings,
  DEFAULT_BRAND_SETTINGS,
} from "@/lib/brandSettings";

/**
 * Server-side store for per-account brand settings, keyed by Stellar
 * address. Follows the same in-memory pattern as serverAddressBook.ts — the
 * module-level map persists for the lifetime of the server process and is
 * shared by the branding API routes.
 */

// In-memory store per server process session, keyed by Stellar address.
const brandStore = new Map<string, BrandSettings>();

function normalizeAddress(address: string): string {
  return address.trim();
}

/**
 * Returns the brand settings for an account, or platform defaults when the
 * account has never saved any.
 */
export function getBrandSettings(address: string): BrandSettings {
  const key = normalizeAddress(address);
  return (
    brandStore.get(key) ?? {
      ...DEFAULT_BRAND_SETTINGS,
      updatedAt: "",
    }
  );
}

/**
 * True when the account has an explicitly-saved settings record.
 */
export function hasBrandSettings(address: string): boolean {
  return brandStore.has(normalizeAddress(address));
}

/**
 * Saves brand settings for an account, replacing any previous record.
 */
export function saveBrandSettings(
  address: string,
  settings: { logoUrl: string | null; accentColor: string | null; tagline: string | null },
): BrandSettings {
  const key = normalizeAddress(address);
  const record: BrandSettings = {
    logoUrl: settings.logoUrl,
    accentColor: settings.accentColor,
    tagline: settings.tagline,
    updatedAt: new Date().toISOString(),
  };
  brandStore.set(key, record);
  return record;
}

/**
 * Removes any stored branding for an account, reverting its invoices to
 * platform-default styling. Returns true when a record existed.
 */
export function clearBrandSettings(address: string): boolean {
  return brandStore.delete(normalizeAddress(address));
}
