import {
  AllowedLogoMimeType,
  LOGO_MIME_EXTENSION,
} from "@/lib/brandSettings";

/**
 * Brand asset (logo) storage.
 *
 * Production: streams uploads to Vercel Blob (`access: "public"`) and returns
 * the CDN-backed `*.public.blob.vercel-storage.com` URL. Set
 * BLOB_READ_WRITE_TOKEN to enable.
 *
 * Local/dev/CI fallback: keeps bytes in a process-level store and serves
 * them through GET /api/settings/branding/logo/[...key] with immutable,
 * year-long cache headers, which is the same shape a CDN edge cache
 * consumes — no external services required.
 */

export interface StoredBrandAsset {
  bytes: Uint8Array;
  contentType: AllowedLogoMimeType;
  createdAt: string;
}

export interface StoreBrandAssetResult {
  /** Public URL (CDN-backed in production) for the stored asset. */
  url: string;
  /** Storage key assigned to the asset. */
  key: string;
  /** True when the asset landed in the Vercel Blob CDN. */
  cdn: boolean;
  /** Detected intrinsic image size (null when headers can't be parsed). */
  width: number | null;
  height: number | null;
  /** Set when the image is likely to look soft at 300 dpi print. */
  lowResolutionWarning: string | null;
}

/** Minimum logo width recommended for crisp 300 dpi print at ~2in display. */
export const RECOMMENDED_LOGO_WIDTH_PX = 600;

// In-memory fallback asset store per server process session.
const assetStore = new Map<string, StoredBrandAsset>();

/** Build the canonical public URL for a locally-stored asset key. */
export function localAssetUrl(key: string): string {
  return `/api/settings/branding/logo/${key}`;
}

/** Retrieve a locally-stored asset (fallback store only). */
export function getStoredBrandAsset(key: string): StoredBrandAsset | null {
  return assetStore.get(key) ?? null;
}

/** Keys are `branding/<address>/logo-<ts>.<ext>` — validate path segments. */
export function isValidAssetKey(key: string): boolean {
  const parts = key.split("/");
  if (parts.length !== 3 || parts[0] !== "branding") return false;
  return parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p));
}

// ── Intrinsic image size parsing (no external deps) ──────────────────────────

function u32be(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function u16be(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function parsePngSize(b: Uint8Array): { width: number; height: number } | null {
  // 8-byte signature + IHDR: width (4B BE) at offset 16, height at 20
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function parseJpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const marker = b[o + 1];
    // SOF0..SOF15 (excluding DHT/DAC/RST markers) carry the frame size
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: u16be(b, o + 5), width: u16be(b, o + 7) };
    }
    const segLen = u16be(b, o + 2);
    if (segLen < 2) return null;
    o += 2 + segLen;
  }
  return null;
}

function parseWebpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const riff = String.fromCharCode(b[0], b[1], b[2], b[3]);
  const webp = String.fromCharCode(b[8], b[9], b[10], b[11]);
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8X") {
    // 24-bit little-endian canvas size minus one, at offsets 24..29
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  if (chunk === "VP8 " && b.length > 29) {
    // Start code 0x9D 0x01 0x2A at 23..25, then 14-bit LE width/height
    if (b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      const width = (b[26] | (b[27] << 8)) & 0x3fff;
      const height = (b[28] | (b[29] << 8)) & 0x3fff;
      return { width, height };
    }
  }
  if (chunk === "VP8L" && b.length > 24) {
    // Signature byte 0x2F then 14-bit LE width/height minus one
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

/** Best-effort intrinsic size detection for PNG / JPEG / WebP buffers. */
export function parseImageDimensions(
  bytes: Uint8Array,
  contentType: AllowedLogoMimeType,
): { width: number; height: number } | null {
  try {
    switch (contentType) {
      case "image/png":
        return parsePngSize(bytes);
      case "image/jpeg":
        return parseJpegSize(bytes);
      case "image/webp":
        return parseWebpSize(bytes);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Stores a validated logo upload and returns its public (CDN-friendly) URL.
 */
export async function storeBrandAsset(params: {
  address: string;
  bytes: Uint8Array;
  contentType: AllowedLogoMimeType;
}): Promise<StoreBrandAssetResult> {
  const { address, bytes, contentType } = params;
  const ext = LOGO_MIME_EXTENSION[contentType];
  const key = `branding/${address}/logo-${Date.now()}.${ext}`;

  const size = parseImageDimensions(bytes, contentType);
  const lowResolutionWarning =
    size && size.width < RECOMMENDED_LOGO_WIDTH_PX
      ? `Logo is ${size.width}px wide — upload at least ${RECOMMENDED_LOGO_WIDTH_PX}px-wide art for sharp 300 dpi print.`
      : null;

  // Production path: Vercel Blob (S3-compatible object store with a CDN).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      url: blob.url,
      key: blob.pathname,
      cdn: true,
      width: size?.width ?? null,
      height: size?.height ?? null,
      lowResolutionWarning,
    };
  }

  // Local/dev fallback: process-level store served via the logo GET route.
  assetStore.set(key, {
    bytes,
    contentType,
    createdAt: new Date().toISOString(),
  });
  return {
    url: localAssetUrl(key),
    key,
    cdn: false,
    width: size?.width ?? null,
    height: size?.height ?? null,
    lowResolutionWarning,
  };
}
