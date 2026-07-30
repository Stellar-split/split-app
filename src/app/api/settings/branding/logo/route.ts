import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_LOGO_MIME_TYPES,
  isAllowedLogoMimeType,
  isLogoSizeOk,
  isStellarAddress,
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  MAX_LOGO_BYTES,
} from "@/lib/brandSettings";
import { storeBrandAsset } from "@/lib/brandAssetStorage";

export const runtime = "nodejs";

/**
 * POST /api/settings/branding/logo
 * multipart/form-data with:
 *   - file: logo image (PNG / JPEG / WebP, max 2 MB) — required
 *   - address: owning account's Stellar address — required
 *
 * Validates MIME type and size BEFORE streaming the file into the brand
 * asset store (Vercel Blob → CDN URL, or the local dev store) and returns
 * { logoUrl, width, height, warning, cdn }.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a file field" },
      { status: 400 },
    );
  }

  const address = form.get("address");
  if (typeof address !== "string" || !isStellarAddress(address.trim())) {
    return NextResponse.json(
      { error: "A valid Stellar address (G + 55 characters) is required" },
      { status: 401 },
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
  }

  // Server-side enforcement of the client-side rules: type allow-list and
  // the 2 MB cap, with the same specific error messages.
  if (!isAllowedLogoMimeType(file.type)) {
    return NextResponse.json({ error: LOGO_TYPE_ERROR }, { status: 415 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!isLogoSizeOk(buffer.byteLength)) {
    return NextResponse.json({ error: LOGO_SIZE_ERROR }, { status: 413 });
  }

  try {
    const stored = await storeBrandAsset({
      address: address.trim(),
      bytes: buffer,
      contentType: file.type,
    });

    return NextResponse.json(
      {
        logoUrl: stored.url,
        key: stored.key,
        cdn: stored.cdn,
        width: stored.width,
        height: stored.height,
        warning: stored.lowResolutionWarning,
        maxBytes: MAX_LOGO_BYTES,
        allowedTypes: ALLOWED_LOGO_MIME_TYPES,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Logo upload failed:", err);
    return NextResponse.json(
      { error: "Logo upload failed. Please try again." },
      { status: 500 },
    );
  }
}
