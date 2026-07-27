import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/invoices/bulk
 *
 * Bulk archive/unarchive operation endpoint.
 * Accepts up to 200 invoice IDs per request with archive status.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceIds, archived } = body as {
      invoiceIds: string[];
      archived: boolean;
    };

    // Validate inputs
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "invoiceIds must be a non-empty array" },
        { status: 400 },
      );
    }

    if (invoiceIds.length > 200) {
      return NextResponse.json(
        { error: "Maximum 200 invoices per request" },
        { status: 400 },
      );
    }

    if (typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "archived must be a boolean" },
        { status: 400 },
      );
    }

    // TODO: Implement actual database storage of archived status
    // For now, this endpoint validates the request and returns success.
    // In production, store archived status in database alongside invoice data.

    return NextResponse.json(
      {
        success: true,
        count: invoiceIds.length,
        archived,
        message: `${invoiceIds.length} invoices ${archived ? "archived" : "unarchived"}`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Bulk invoice operation error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk operation" },
      { status: 500 },
    );
  }
}
