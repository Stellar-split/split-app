import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  brandSettingsSchema,
  DEFAULT_BRAND_SETTINGS,
  isStellarAddress,
} from "@/lib/brandSettings";
import {

  clearBrandSettings,
  getBrandSettings,
  saveBrandSettings,
} from "@/lib/brandSettingsStore";

const INVALID_ADDRESS_ERROR =
  "A valid Stellar address (G + 55 characters) is required to scope branding to an account";

/**
 * GET /api/settings/branding?address=<stellar-address>
 * Returns the account's brand settings, or platform defaults when unset.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isStellarAddress(address.trim())) {
    return NextResponse.json({ error: INVALID_ADDRESS_ERROR }, { status: 400 });
  }

  const settings = getBrandSettings(address.trim());
  return NextResponse.json({ ...DEFAULT_BRAND_SETTINGS, ...settings }, { status: 200 });
}

/**
 * PUT /api/settings/branding
 * Body: { address, logoUrl?, accentColor?, tagline? }
 * Validates brand metadata (hex color + WCAG AA contrast against white)
 * and stores it in the account's settings record.
 */
export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { address, ...fields } = (body ?? {}) as Record<string, unknown>;

  if (typeof address !== "string" || !isStellarAddress(address.trim())) {
    return NextResponse.json({ error: INVALID_ADDRESS_ERROR }, { status: 400 });
  }

  const parsed = brandSettingsSchema.safeParse(fields);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid brand settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const saved = saveBrandSettings(address.trim(), {
    logoUrl: parsed.data.logoUrl ?? null,
    accentColor: parsed.data.accentColor ?? null,
    tagline: parsed.data.tagline ?? null,
  });

  return NextResponse.json(saved, { status: 200 });
}

/**
 * DELETE /api/settings/branding
 * Body (or query): { address }
 * Clears the account's branding so invoices revert to platform defaults.
 */
export async function DELETE(request: NextRequest) {
  let address = request.nextUrl.searchParams.get("address");

  if (!address) {
    try {
      const body = await request.json();
      address = typeof body?.address === "string" ? body.address : null;
    } catch {
      // ignore body parse failure
    }
  }

  if (!address || !isStellarAddress(address.trim())) {
    return NextResponse.json({ error: INVALID_ADDRESS_ERROR }, { status: 400 });
  }

  clearBrandSettings(address.trim());
  return NextResponse.json({ success: true }, { status: 200 });
}
