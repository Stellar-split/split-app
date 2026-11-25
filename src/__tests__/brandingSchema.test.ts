import { describe, expect, it } from "vitest";
import {
  brandSettingsSchema,
  isAllowedLogoMimeType,
  isLogoSizeOk,
  isStellarAddress,
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  MAX_LOGO_BYTES,
  MAX_TAGLINE_LENGTH,
} from "@/lib/brandSettings";

describe("brandSettingsSchema", () => {
  it("accepts a fully-populated valid record", () => {
    const result = brandSettingsSchema.safeParse({
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#4f46e5",
      tagline: "Fast, fair splits",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.logoUrl).toBe("https://cdn.example.com/logo.png");
      expect(result.data.accentColor).toBe("#4f46e5");
      expect(result.data.tagline).toBe("Fast, fair splits");
    }
  });

  it("accepts root-relative logo URLs served by the local asset route", () => {
    const result = brandSettingsSchema.safeParse({
      logoUrl: "/api/settings/branding/logo/branding/GABC/logo-1.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.logoUrl).toBe("/api/settings/branding/logo/branding/GABC/logo-1.png");
    }
  });

  it("treats empty strings as cleared (null) fields", () => {
    const result = brandSettingsSchema.safeParse({ logoUrl: "", accentColor: "", tagline: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ logoUrl: null, accentColor: null, tagline: null });
    }
  });

  it("accepts an empty object (all fields optional)", () => {
    const result = brandSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it.each(["blue", "#12", "#gggggg", "4f46e5ff"])("rejects invalid hex color %j", (color) => {
    const result = brandSettingsSchema.safeParse({ accentColor: color });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("valid hex color");
    }
  });

  it.each(["#ffffff", "#f2f2f2", "#777777", "#ffff00"])(
    "rejects accent color %s failing WCAG AA contrast against white",
    (color) => {
      const result = brandSettingsSchema.safeParse({ accentColor: color });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("WCAG AA");
      }
    },
  );

  it.each(["#4f46e5", "#767676", "#b91c1c", "#047857"])(
    "accepts accent color %s meeting WCAG AA against white",
    (color) => {
      const result = brandSettingsSchema.safeParse({ accentColor: color });
      expect(result.success).toBe(true);
    },
  );

  it("rejects logo URLs that are not absolute http(s) or root-relative", () => {
    const result = brandSettingsSchema.safeParse({ logoUrl: "notaurl" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Logo URL must be a valid URL");
    }
  });

  it(`rejects taglines longer than ${MAX_TAGLINE_LENGTH} characters`, () => {
    const result = brandSettingsSchema.safeParse({ tagline: "x".repeat(MAX_TAGLINE_LENGTH + 1) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(`${MAX_TAGLINE_LENGTH} characters`);
    }
  });

  it(`accepts a tagline of exactly ${MAX_TAGLINE_LENGTH} characters`, () => {
    const result = brandSettingsSchema.safeParse({ tagline: "x".repeat(MAX_TAGLINE_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("trims tagline whitespace and nulls whitespace-only taglines", () => {
    const result = brandSettingsSchema.safeParse({ tagline: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagline).toBeNull();
    }
  });
});

describe("logo upload guards", () => {
  it("allows exactly PNG, JPEG and WebP MIME types", () => {
    expect(isAllowedLogoMimeType("image/png")).toBe(true);
    expect(isAllowedLogoMimeType("image/jpeg")).toBe(true);
    expect(isAllowedLogoMimeType("image/webp")).toBe(true);
    expect(isAllowedLogoMimeType("image/gif")).toBe(false);
    expect(isAllowedLogoMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedLogoMimeType("text/plain")).toBe(false);
    expect(isAllowedLogoMimeType("application/octet-stream")).toBe(false);
  });

  it("enforces the 2 MB size cap inclusively", () => {
    expect(isLogoSizeOk(1)).toBe(true);
    expect(isLogoSizeOk(MAX_LOGO_BYTES)).toBe(true);
    expect(isLogoSizeOk(MAX_LOGO_BYTES + 1)).toBe(false);
    expect(isLogoSizeOk(0)).toBe(false);
  });

  it("exposes specific, user-facing rejection messages", () => {
    expect(LOGO_TYPE_ERROR).toBe("Unsupported file type. Upload a PNG, JPEG, or WebP image.");
    expect(LOGO_SIZE_ERROR).toBe("Logo exceeds the 2 MB size limit.");
  });
});

describe("isStellarAddress", () => {
  it("accepts well-formed Stellar public keys", () => {
    expect(isStellarAddress("GBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65A")).toBe(true);
  });

  it.each(["", "GABC", "xBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65A", "GBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65!"])(
    "rejects malformed address %j",
    (address) => {
      expect(isStellarAddress(address)).toBe(false);
    },
  );
});
