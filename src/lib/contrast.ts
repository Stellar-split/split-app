/**
 * WCAG 2.1 relative-luminance / contrast-ratio utilities.
 * Used to validate brand accent colors against invoice backgrounds.
 */

/** Minimum contrast ratio required by WCAG AA for normal text. */
export const WCAG_AA_CONTRAST_RATIO = 4.5;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses a hex color string ("#RGB" or "#RRGGBB", case-insensitive, "#"
 * optional) into an RGB tuple. Returns null for anything else.
 */
export function hexToRgb(hex: string): RgbColor | null {
  const trimmed = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$/.test(trimmed) && !/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }
  const normalized =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((c) => c + c)
          .join("")
      : trimmed;
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

/** True when the string is a well-formed hex color (#RGB / #RRGGBB). */
export function isValidHexColor(hex: string): boolean {
  return hexToRgb(hex) !== null;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/**
 * WCAG 2.1 contrast ratio between two hex colors (1..21).
 * Accepts colors in any order — the lighter one is luminance-maximized.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns an object describing whether `hex` meets WCAG AA contrast (4.5:1)
 * for text rendered in `hex` over a `background` background (default white,
 * which is what the invoice PDF / print view uses).
 */
export function checkContrast(
  hex: string,
  background = "#ffffff",
): { ratio: number; passes: boolean } {
  const ratio = contrastRatio(hex, background);
  return { ratio, passes: ratio >= WCAG_AA_CONTRAST_RATIO };
}

/** Convenience boolean: does this color pass WCAG AA against white? */
export function meetsWcagAaAgainstWhite(hex: string): boolean {
  try {
    return checkContrast(hex, "#ffffff").passes;
  } catch {
    return false;
  }
}
