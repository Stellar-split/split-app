import { describe, expect, it } from "vitest";
import { isRtl, localeMetadata } from "@/lib/receiptI18n";

describe("receipt locale metadata", () => {
  it("marks supported locale direction explicitly", () => {
    expect(Object.values(localeMetadata).every(({ rtl }) => rtl === false)).toBe(true);
  });

  it.each(["ar", "ar-SA", "fa_IR", "he", "ur-PK"])(
    "recognizes RTL locale %s",
    (locale) => {
      expect(isRtl(locale)).toBe(true);
    },
  );

  it.each(["en", "es-MX", "pt_BR", "fr", ""])(
    "recognizes non-RTL locale %s",
    (locale) => {
      expect(isRtl(locale)).toBe(false);
    },
  );
});