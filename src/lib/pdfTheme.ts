/**
 * Colour tokens used by the PDF export pipeline.
 *
 * The light theme is the historical default; `darkTheme` mirrors its shape so
 * callers can swap themes without branching on individual colour keys. All
 * text/accent colours are chosen to satisfy WCAG AA (4.5:1) against their
 * respective backgrounds — see `src/lib/contrast.ts` for the checker.
 */

export interface PdfTheme {
  /** Page background colour. */
  background: string;
  /** Primary body text colour. */
  text: string;
  /** Muted/secondary text colour (labels, footnotes). */
  mutedText: string;
  /** Brand accent used for headings, rules and links. */
  accent: string;
  /** Table header / zebra-stripe surface. */
  surface: string;
  /** Border colour for tables and dividers. */
  border: string;
}

/** Default light colour scheme for PDF exports. */
export const lightTheme: PdfTheme = {
  background: "#ffffff",
  text: "#1f2937",
  mutedText: "#4b5563",
  accent: "#1d4ed8",
  surface: "#f3f4f6",
  border: "#d1d5db",
};

/**
 * Dark colour scheme for PDF exports.
 *
 * Contrast ratios against `background` (#111827):
 *   text       #f9fafb -> ~17.4:1
 *   mutedText  #d1d5db -> ~11.6:1
 *   accent     #93c5fd -> ~9.6:1
 * All comfortably exceed the WCAG AA 4.5:1 threshold.
 */
export const darkTheme: PdfTheme = {
  background: "#111827",
  text: "#f9fafb",
  mutedText: "#d1d5db",
  accent: "#93c5fd",
  surface: "#1f2937",
  border: "#374151",
};

/**
 * Selects the PDF colour scheme for a render pass.
 *
 * @param preferDark when true, returns `darkTheme`; otherwise `lightTheme`.
 */
export function getPdfTheme(preferDark = false): PdfTheme {
  return preferDark ? darkTheme : lightTheme;
}

export interface PDFThemeClasses {
  container: string;
  subtitle: string;
  borderRow: string;
  borderHeaderRow: string;
  recipientRow: string;
  watermark: string;
}

/**
 * Returns Tailwind CSS classes for PDF rendering based on mode and theme.
 * Print mode always uses light colors for printing, screen mode respects the theme.
 */
export function getPDFThemeClasses(mode: "print" | "screen", theme: "light" | "dark"): PDFThemeClasses {
  if (mode === "print") {
    return {
      container: "bg-white text-black",
      subtitle: "text-gray-500",
      borderRow: "border-gray-200",
      borderHeaderRow: "border-gray-300",
      recipientRow: "border-gray-100",
      watermark: "text-gray-800",
    };
  }

  if (theme === "dark") {
    return {
      container: "bg-gray-900 text-gray-100",
      subtitle: "text-gray-400",
      borderRow: "border-gray-700",
      borderHeaderRow: "border-gray-600",
      recipientRow: "border-gray-800",
      watermark: "text-gray-300",
    };
  }

  return {
    container: "bg-white text-black",
    subtitle: "text-gray-500",
    borderRow: "border-gray-200",
    borderHeaderRow: "border-gray-300",
    recipientRow: "border-gray-100",
    watermark: "text-gray-800",
  };
}
