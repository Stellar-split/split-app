import { contrastRatio, hexToRgb, meetsWcagAaAgainstWhite } from "@/lib/contrast";

export interface BrandPreset {
  name: string;
  accentColor: string;
}

/** Every preset meets WCAG AA (4.5:1) against white, the invoice background. */
export const BRAND_PRESETS: BrandPreset[] = [
  { name: "Indigo", accentColor: "#4f46e5" },
  { name: "Emerald", accentColor: "#047857" },
  { name: "Crimson", accentColor: "#be123c" },
  { name: "Ocean", accentColor: "#0369a1" },
  { name: "Amber", accentColor: "#b45309" },
  { name: "Violet", accentColor: "#7c3aed" },
  { name: "Slate", accentColor: "#334155" },
];

const toHexPair = (n: number) => n.toString(16).padStart(2, "0");

/** Normalizes "#RGB" / "#RRGGBB" (any case, "#" optional) to lowercase "#rrggbb", or null. */
export function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb ? `#${toHexPair(rgb.r)}${toHexPair(rgb.g)}${toHexPair(rgb.b)}` : null;
}

/**
 * Darkens `hex` in 5% steps towards black until it meets WCAG AA against
 * white. Returns the normalized color unchanged when it already passes, and
 * null for an invalid color.
 */
export function suggestAccessibleAccent(hex: string): string | null {
  const normalized = normalizeHex(hex);
  const rgb = hexToRgb(hex);
  if (!normalized || !rgb) return null;
  for (let step = 0; step <= 20; step++) {
    const factor = 1 - step / 20;
    const candidate = `#${toHexPair(Math.round(rgb.r * factor))}${toHexPair(
      Math.round(rgb.g * factor),
    )}${toHexPair(Math.round(rgb.b * factor))}`;
    if (meetsWcagAaAgainstWhite(candidate)) return candidate;
  }
  return "#000000";
}

/** Black or white, whichever is more legible on top of `background`. */
export function readableTextColor(background: string): "#ffffff" | "#000000" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000";
}
