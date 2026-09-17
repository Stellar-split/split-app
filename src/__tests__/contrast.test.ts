import { describe, expect, it } from "vitest";
import {
  checkContrast,
  contrastRatio,
  hexToRgb,
  isValidHexColor,
  meetsWcagAA,
  meetsWcagAaAgainstWhite,
  relativeLuminance,
  WCAG_AA_CONTRAST_RATIO,
  WCAG_AA_LARGE_TEXT_CONTRAST_RATIO,
} from "@/lib/contrast";

describe("contrast utilities (WCAG 2.1)", () => {
  describe("hexToRgb", () => {
    it("parses 6-digit hex colors", () => {
      expect(hexToRgb("#4f46e5")).toEqual({ r: 0x4f, g: 0x46, b: 0xe5 });
    });

    it("parses 6-digit hex without the leading #", () => {
      expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("expands 3-digit shorthand", () => {
      expect(hexToRgb("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    });

    it("is case-insensitive", () => {
      expect(hexToRgb("#AABBCC")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    });

    it.each(["", "#", "#12", "#1234", "blue", "#gggggg", "#1234567"])(
      "returns null for invalid input %j",
      (input) => {
        expect(hexToRgb(input)).toBeNull();
      },
    );
  });

  describe("isValidHexColor", () => {
    it("accepts valid colors", () => {
      expect(isValidHexColor("#4f46e5")).toBe(true);
      expect(isValidHexColor("#abc")).toBe(true);
    });

    it("rejects invalid colors", () => {
      expect(isValidHexColor("not-a-color")).toBe(false);
      expect(isValidHexColor("#12345")).toBe(false);
    });
  });

  describe("relativeLuminance", () => {
    it("is 0 for black and 1 for white", () => {
      expect(relativeLuminance("#000000")).toBe(0);
      expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    });

    it("throws for invalid colors", () => {
      expect(() => relativeLuminance("nope")).toThrow("Invalid hex color");
    });
  });

  describe("contrastRatio", () => {
    it("returns 21:1 for black on white", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    });

    it("returns 1:1 for identical colors", () => {
      expect(contrastRatio("#4f46e5", "#4f46e5")).toBeCloseTo(1, 10);
    });

    it("is symmetric in its arguments", () => {
      expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 10);
    });
  });

  describe("checkContrast against white", () => {
    it("passes the platform default accent (#4f46e5 ≈ 6.29:1)", () => {
      const { ratio, passes } = checkContrast("#4f46e5");
      expect(ratio).toBeCloseTo(6.29, 1);
      expect(passes).toBe(true);
    });

    it("passes gray at the WCAG AA boundary (#767676 ≈ 4.54:1)", () => {
      const { ratio, passes } = checkContrast("#767676");
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST_RATIO);
      expect(passes).toBe(true);
    });

    it("fails gray just below the boundary (#777777 ≈ 4.48:1)", () => {
      const { ratio, passes } = checkContrast("#777777");
      expect(ratio).toBeLessThan(WCAG_AA_CONTRAST_RATIO);
      expect(passes).toBe(false);
    });

    it("fails white on white", () => {
      const { ratio, passes } = checkContrast("#ffffff", "#ffffff");
      expect(ratio).toBe(1);
      expect(passes).toBe(false);
    });
  });

  describe("meetsWcagAaAgainstWhite", () => {
    it("accepts readable colors", () => {
      expect(meetsWcagAaAgainstWhite("#4f46e5")).toBe(true);
      expect(meetsWcagAaAgainstWhite("#000000")).toBe(true);
    });

    it("rejects washed-out colors", () => {
      expect(meetsWcagAaAgainstWhite("#ffffff")).toBe(false);
      expect(meetsWcagAaAgainstWhite("#f2f2f2")).toBe(false);
    });

    it("rejects unparseable colors instead of throwing", () => {
      expect(meetsWcagAaAgainstWhite("definitely-not-hex")).toBe(false);
    });
  });

  describe("meetsWcagAA", () => {
    it("returns true for black on white (21:1 ratio)", () => {
      expect(meetsWcagAA("#000000", "#ffffff")).toBe(true);
    });

    it("returns false for #777777 on #ffffff for normal text (fails 4.5:1)", () => {
      expect(meetsWcagAA("#777777", "#ffffff")).toBe(false);
    });

    it("returns true for #777777 on #ffffff for large text (passes 3:1)", () => {
      expect(meetsWcagAA("#777777", "#ffffff", true)).toBe(true);
    });

    it("accepts rgb() and rgba() syntax", () => {
      expect(meetsWcagAA("rgb(0, 0, 0)", "rgb(255, 255, 255)")).toBe(true);
      expect(meetsWcagAA("rgba(0, 0, 0, 1)", "rgba(255, 255, 255, 1)")).toBe(true);
      expect(meetsWcagAA("rgb(119, 119, 119)", "rgb(255, 255, 255)")).toBe(false);
      expect(meetsWcagAA("rgb(119, 119, 119)", "rgb(255, 255, 255)", true)).toBe(true);
    });

    it("returns false gracefully on invalid color inputs", () => {
      expect(meetsWcagAA("not-a-color", "#ffffff")).toBe(false);
      expect(meetsWcagAA("#000000", "invalid-bg")).toBe(false);
    });
  });
});

