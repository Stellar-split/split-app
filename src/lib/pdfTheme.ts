export type ExportMode = "print" | "screen";

export interface PDFThemeClasses {
  container: string;
  subtitle: string;
  borderRow: string;
  borderHeaderRow: string;
  recipientRow: string;
  watermark: string;
}

export function getPDFThemeClasses(
  mode: ExportMode,
  resolvedTheme: "light" | "dark",
): PDFThemeClasses {
  if (mode === "screen" && resolvedTheme === "dark") {
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
