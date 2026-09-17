import { describe, it, expect } from "vitest";
import {
  isRtl,
  getReceiptDirection,
  t,
  formatDate,
  translations,
} from "../receiptI18n";

describe("receiptI18n", () => {
  describe("RTL metadata & isRtl", () => {
    it("returns true for standard RTL locales (ar, he, fa, ur)", () => {
      expect(isRtl("ar")).toBe(true);
      expect(isRtl("he")).toBe(true);
      expect(isRtl("fa")).toBe(true);
      expect(isRtl("ur")).toBe(true);
    });

    it("handles regional sub-tags like ar-SA, ur-PK, fa-IR, he-IL", () => {
      expect(isRtl("ar-SA")).toBe(true);
      expect(isRtl("ar_EG")).toBe(true);
      expect(isRtl("ur-PK")).toBe(true);
      expect(isRtl("fa-IR")).toBe(true);
      expect(isRtl("he-IL")).toBe(true);
    });

    it("returns false for LTR locales (en, es, pt, fr, de, etc.)", () => {
      expect(isRtl("en")).toBe(false);
      expect(isRtl("es")).toBe(false);
      expect(isRtl("pt")).toBe(false);
      expect(isRtl("fr")).toBe(false);
      expect(isRtl("de")).toBe(false);
    });

    it("returns false for empty or invalid locale string", () => {
      expect(isRtl("")).toBe(false);
      expect(isRtl("   ")).toBe(false);
    });

    it("includes rtl: boolean metadata in each translation entry", () => {
      expect(translations.en.rtl).toBe(false);
      expect(translations.es.rtl).toBe(false);
      expect(translations.pt.rtl).toBe(false);
      expect(translations.fr.rtl).toBe(false);
      expect(translations.ar.rtl).toBe(true);
      expect(translations.he.rtl).toBe(true);
      expect(translations.fa.rtl).toBe(true);
      expect(translations.ur.rtl).toBe(true);
    });
  });

  describe("getReceiptDirection", () => {
    it("returns 'rtl' for RTL languages", () => {
      expect(getReceiptDirection("ar")).toBe("rtl");
      expect(getReceiptDirection("he")).toBe("rtl");
      expect(getReceiptDirection("fa")).toBe("rtl");
      expect(getReceiptDirection("ur")).toBe("rtl");
    });

    it("returns 'ltr' for non-RTL languages", () => {
      expect(getReceiptDirection("en")).toBe("ltr");
      expect(getReceiptDirection("es")).toBe("ltr");
      expect(getReceiptDirection("fr")).toBe("ltr");
      expect(getReceiptDirection("pt")).toBe("ltr");
    });
  });

  describe("translations and formatting", () => {
    it("translates existing keys properly", () => {
      expect(t("en", "invoice")).toBe("Invoice");
      expect(t("es", "invoice")).toBe("Factura");
      expect(t("ar", "invoice")).toBe("فاتورة");
      expect(t("en", "unknownKey")).toBe("unknownKey");
    });

    it("formats dates according to locale", () => {
      const d = new Date("2026-09-17T12:00:00Z");
      const enFormatted = formatDate(d, "en");
      expect(enFormatted).toBeDefined();
      expect(typeof enFormatted).toBe("string");
    });
  });
});
