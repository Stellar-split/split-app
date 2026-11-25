/**
 * avatar — Gravatar URLs and deterministic fallback avatars for recipients.
 *
 * A recipient either has a stored email (Gravatar) or nothing but a Stellar
 * public key, in which case we derive a stable colour from the key so the same
 * recipient always renders the same swatch.
 */
import { md5 } from "@/lib/md5";

export const GRAVATAR_BASE = "https://www.gravatar.com/avatar";

/**
 * Build a Gravatar URL for an email address.
 *
 * Always HTTPS, and always `d=404` so a missing profile fails loudly (404)
 * rather than silently serving a generic placeholder — that's what lets the
 * Avatar component fall back to the deterministic swatch.
 */
export function gravatarUrl(email: string, size = 64): string {
  const hash = md5(email.trim().toLowerCase());
  return `${GRAVATAR_BASE}/${hash}?s=${size}&d=404`;
}

/**
 * Palette for deterministic avatars. Chosen to stay legible against the
 * dark row background while remaining distinguishable from one another.
 */
export const AVATAR_COLORS = [
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
  "#db2777", // pink
  "#65a30d", // lime
] as const;

/** Number of leading address characters that seed the deterministic avatar. */
export const AVATAR_SEED_LENGTH = 4;

/**
 * Deterministic colour derived from the first 4 characters of the public key.
 * Stellar addresses all start with "G", so the seed carries ~3 chars of entropy
 * — enough to spread across the palette, and stable for a given address.
 */
export function avatarColorFromAddress(address: string): string {
  const seed = (address || "").slice(0, AVATAR_SEED_LENGTH);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Initials shown inside a deterministic avatar. */
export function avatarInitials(address: string): string {
  if (!address) return "?";
  return address.slice(0, 2).toUpperCase();
}

/** Alt text for a recipient avatar — the first 6 characters of the address. */
export function avatarAltText(address: string): string {
  if (!address) return "Unknown recipient avatar";
  return `Avatar for ${address.slice(0, 6)}`;
}

/** Inline SVG data URI for the deterministic avatar (used as a stable fallback). */
export function deterministicAvatarDataUri(address: string, size = 32): string {
  const color = avatarColorFromAddress(address);
  const initials = avatarInitials(address);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="${color}"/><text x="16" y="21" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
