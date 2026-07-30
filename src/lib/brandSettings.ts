import { z } from "zod";
import { checkContrast, isValidHexColor, WCAG_AA_CONTRAST_RATIO } from "@/lib/contrast";

/** Maximum accepted logo upload size: 2 MB. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** MIME types accepted for logo uploads. */
export const ALLOWED_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

/** Extension mapping used when building storage keys for uploaded logos. */
export const LOGO_MIME_EXTENSION: Record<AllowedLogoMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Max characters for the invoice tagline. */
export const MAX_TAGLINE_LENGTH = 120;

export const LOGO_TYPE_ERROR =
  "Unsupported file type. Upload a PNG, JPEG, or WebP image.";
export const LOGO_SIZE_ERROR = "Logo exceeds the 2 MB size limit.";

/** True when the (already-typechecked) logo fits the 2 MB cap. */
export function isLogoSizeOk(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_LOGO_BYTES;
}

/** True when the supplied MIME type is in the logo allow-list. */
export function isAllowedLogoMimeType(mime: string): mime is AllowedLogoMimeType {
  return (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Brand settings scoped to one user account (identified by their Stellar
 * address). `null` means "not set — fall back to platform defaults".
 */
export interface BrandSettings {
  logoUrl: string | null;
  accentColor: string | null;
  tagline: string | null;
  updatedAt: string;
}

/** Platform-default branding (used when the user has not customized). */
export const DEFAULT_BRAND_SETTINGS: Omit<BrandSettings, "updatedAt"> = {
  logoUrl: null,
  accentColor: null,
  tagline: null,
};

/** Platform default accent used when no accent color is configured. */
export const DEFAULT_ACCENT_COLOR = "#4f46e5";

const hexColorSchema = z
  .string()
  .trim()
  .refine(isValidHexColor, {
    message: "Enter a valid hex color (e.g. #4f46e5)",
  })
  .superRefine((value, ctx) => {
    if (!isValidHexColor(value)) return;
    const { ratio, passes } = checkContrast(value, "#ffffff");
    if (!passes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Accent color fails WCAG AA contrast against white (${ratio.toFixed(
          2,
        )}:1; needs ${WCAG_AA_CONTRAST_RATIO}:1)`,
      });
    }
  });

/**
 * Accepts absolute http(s) URLs (CDN-hosted logos in production) or
 * root-relative paths (the local dev asset route, e.g.
 * "/api/settings/branding/logo/branding/<addr>/logo-1.png").
 */
const logoUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    { message: "Logo URL must be a valid URL" },
  );

/**
 * Zod schema shared by the branding form (react-hook-form resolver) and the
 * PUT /api/settings/branding route. Empty strings and null treat a field as
 * "cleared / platform default".
 */
export const brandSettingsSchema = z.object({
  logoUrl: z
    .union([z.literal(""), logoUrlSchema])
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null))
    .optional(),
  accentColor: z
    .union([z.literal(""), hexColorSchema])
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null))
    .optional(),
  tagline: z
    .string()
    .trim()
    .max(MAX_TAGLINE_LENGTH, `Tagline must be ${MAX_TAGLINE_LENGTH} characters or fewer`)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

export type BrandSettingsInput = z.input<typeof brandSettingsSchema>;
export type BrandSettingsOutput = z.output<typeof brandSettingsSchema>;

/** Basic Stellar public key sanity check (G + 55 base32 chars). */
export function isStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
