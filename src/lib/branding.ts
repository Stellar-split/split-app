import type { BrandSettings } from "@/lib/brandSettings";
import { DEFAULT_BRAND_SETTINGS } from "@/lib/brandSettings";

/**
 * Client helpers for account branding: fetch/save/clear through the settings
 * API with a localStorage mirror so invoices paint instantly on repeat views
 * and stay branded when the dev server restarts.
 */

const cacheKey = (address: string) => `stellarsplit:branding:${address}`;

function readCache(address: string): BrandSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        logoUrl: parsed.logoUrl ?? null,
        accentColor: parsed.accentColor ?? null,
        tagline: parsed.tagline ?? null,
        updatedAt: parsed.updatedAt ?? "",
      };
    }
  } catch {
    // malformed cache — ignore
  }
  return null;
}

function writeCache(address: string, settings: BrandSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(address), JSON.stringify(settings));
  } catch {
    // storage unavailable — server record still persists
  }
}

function clearCache(address: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(address));
  } catch {
    // ignore
  }
}

/**
 * Fetches the brand settings for an account. Falls back to the localStorage
 * mirror when the network call fails, and finally to platform defaults.
 */
export async function fetchBrandSettings(address: string): Promise<BrandSettings> {
  try {
    const res = await fetch(`/api/settings/branding?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = (await res.json()) as BrandSettings;
    writeCache(address, settings);
    return settings;
  } catch {
    return (
      readCache(address) ?? { ...DEFAULT_BRAND_SETTINGS, updatedAt: "" }
    );
  }
}

/** Persists brand settings for an account via the settings API. */
export async function saveBrandSettingsRemote(
  address: string,
  settings: { logoUrl: string | null; accentColor: string | null; tagline: string | null },
): Promise<BrandSettings> {
  const res = await fetch("/api/settings/branding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, ...settings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Could not save branding");
  }
  writeCache(address, data as BrandSettings);
  return data as BrandSettings;
}

/** Clears brand settings for an account (invoice styling reverts to default). */
export async function clearBrandSettingsRemote(address: string): Promise<void> {
  const res = await fetch("/api/settings/branding", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data?.error === "string" ? data.error : "Could not clear branding");
  }
  clearCache(address);
}

/**
 * Uploads a logo file for an account; returns the assigned URL. Client-side
 * pre-validation in BrandingForm means the server should only fail this
 * request for genuine transport/storage errors.
 */
export async function uploadBrandLogo(
  address: string,
  file: File,
): Promise<{ logoUrl: string; width: number | null; height: number | null; warning: string | null; cdn: boolean }> {
  const form = new FormData();
  form.append("file", file);
  form.append("address", address);
  const res = await fetch("/api/settings/branding/logo", {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Logo upload failed");
  }
  return data;
}
