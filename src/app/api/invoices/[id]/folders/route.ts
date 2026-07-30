import { NextRequest, NextResponse } from "next/server";
import { FolderMembershipSchema, getFoldersForInvoice, setFoldersForInvoice } from "@/lib/folders";

/** GET /api/invoices/:id/folders — folder ids this invoice currently belongs to. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json(
      { invoiceId: params.id, folderIds: getFoldersForInvoice(params.id) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Invoice folder fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch invoice folders",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/invoices/:id/folders — replace the invoice's folder membership.
 *
 * The client sends the full desired list (both adds and removes go through
 * here), matching `PATCH /api/invoices/:id/tags`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await request.json();
    const parsed = FolderMembershipSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload — expected { folderIds: string[] }",
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const folderIds = setFoldersForInvoice(params.id, parsed.data.folderIds);

    return NextResponse.json(
      { success: true, invoiceId: params.id, folderIds },
      { status: 200 }
    );
  } catch (error) {
    console.error("Invoice folder save error:", error);
    return NextResponse.json(
      {
        error: "Failed to save invoice folders",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
