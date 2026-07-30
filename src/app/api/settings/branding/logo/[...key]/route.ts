import { NextRequest, NextResponse } from "next/server";
import { getStoredBrandAsset, isValidAssetKey } from "@/lib/brandAssetStorage";

export const runtime = "nodejs";

/**
 * GET /api/settings/branding/logo/<...key>
 * Serves a locally-stored brand logo with immutable, year-long cache headers
 * so the URL can sit behind any CDN edge cache. Used in dev/CI; production
 * uploads go straight to the Vercel Blob CDN.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string[] } },
) {
  const key = (params.key ?? []).join("/");

  if (!key || !isValidAssetKey(key)) {
    return NextResponse.json({ error: "Invalid asset key" }, { status: 400 });
  }

  const asset = getStoredBrandAsset(key);
  if (!asset) {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }

  return new NextResponse(asset.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
