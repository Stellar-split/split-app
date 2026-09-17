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

/** Parses hex, rgb(), or rgba() color strings into an RGB tuple. Returns null if invalid. */
export function parseColor(color: string): RgbColor | null {
  const trimmed = color.trim();
  const hex = hexToRgb(trimmed);
  if (hex) return hex;

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i,
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      return { r, g, b };
    }
  }

  return null;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white). Accepts hex, rgb(), and rgba(). */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) {
    throw new Error(`Invalid hex color: ${color}`);
  }
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/**
 * WCAG 2.1 contrast ratio between two colors (1..21).
 * Accepts colors in any order — the lighter one is luminance-maximized.
 */
export function contrastRatio(colorA: string, colorB: string): number {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
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

/** Minimum contrast ratio required by WCAG AA for large text (18pt+ or 14pt+ bold). */
export const WCAG_AA_LARGE_TEXT_CONTRAST_RATIO = 3.0;

/**
 * Checks whether a foreground color on a background color meets WCAG 2.1 AA standards:
 * - 4.5:1 for normal text (default)
 * - 3.0:1 for large text (18pt+ or 14pt+ bold)
 *
 * Accepts hex (#RGB, #RRGGBB), rgb(), and rgba() strings.
 */
export function meetsWcagAA(
  foreground: string,
  background: string,
  largeText: boolean = false,
): boolean {
  try {
    const ratio = contrastRatio(foreground, background);
    const threshold = largeText
      ? WCAG_AA_LARGE_TEXT_CONTRAST_RATIO
      : WCAG_AA_CONTRAST_RATIO;
    return ratio >= threshold;
  } catch {
    return false;
  }
}

/** Convenience boolean: does this color pass WCAG AA against white? */
export function meetsWcagAaAgainstWhite(hex: string): boolean {
  try {
    return checkContrast(hex, "#ffffff").passes;
  } catch {
    return false;
  }
}

