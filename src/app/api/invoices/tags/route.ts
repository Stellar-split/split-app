import { NextRequest, NextResponse } from "next/server";
import { getAllTags, getTagMap } from "@/lib/invoiceTags";

/**
 * GET /api/invoices/tags — every tag in use, plus the invoiceId → tags map.
 *
 * One request serves both autocomplete (the flat list) and list filtering
 * (the map), so the dashboard doesn't fan out a request per invoice.
 *
 * Note: this static segment takes precedence over the sibling `[id]` dynamic
 * segment, so it never collides with /api/invoices/:id.
 */
export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json({ tags: getAllTags(), byInvoice: getTagMap() }, { status: 200 });
  } catch (error) {
    console.error("Tag list error:", error);
    return NextResponse.json(
      {
        error: "Failed to list tags",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
