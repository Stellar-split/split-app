import { NextRequest, NextResponse } from "next/server";
import {
  getServerAddressBook,
  addServerAddressBookEntry,
  updateServerAddressBookEntry,
  deleteServerAddressBookEntry,
} from "@/lib/serverAddressBook";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

/**
 * GET /api/settings/address-book
 * Returns all saved address book contacts sorted alphabetically by label.
 */
export async function GET() {
  const entries = getServerAddressBook();
  return NextResponse.json(entries, { status: 200 });
}

/**
 * POST /api/settings/address-book
 * Creates a new address book entry. Returns 409 status on duplicate address.
 */
export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { address, label } = body || {};

    if (!address || typeof address !== "string" || !address.trim()) {
      return NextResponse.json(
        { error: "Recipient Stellar address is required" },
        { status: 400 }
      );
    }

    const trimmedLabel = typeof label === "string" ? label.trim() : "";
    const result = addServerAddressBookEntry({
      address: address.trim(),
      label: trimmedLabel,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

/**
 * PUT /api/settings/address-book
 * Updates an existing address book entry's label or address.
 */
export async function PUT(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { id, address, label } = body || {};

    const targetKey = id || address;
    if (!targetKey) {
      return NextResponse.json(
        { error: "Contact ID or address is required" },
        { status: 400 }
      );
    }

    const result = updateServerAddressBookEntry(targetKey, { address, label });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

/**
 * DELETE /api/settings/address-book
 * Removes an entry by id or address.
 */
export async function DELETE(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  const { searchParams } = new URL(request.url);
  let idOrAddress = searchParams.get("id") || searchParams.get("address");

  if (!idOrAddress) {
    try {
      const body = await request.json();
      idOrAddress = body?.id || body?.address;
    } catch {
      // ignore body parse failure
    }
  }

  if (!idOrAddress) {
    return NextResponse.json(
      { error: "ID or address is required for deletion" },
      { status: 400 }
    );
  }

  const success = deleteServerAddressBookEntry(idOrAddress);
  if (!success) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
