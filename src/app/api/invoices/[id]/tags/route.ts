import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  MAX_TAGS_PER_INVOICE,
  TagsPayloadSchema,
  getTags,
  setTags,
} from "@/lib/invoiceTags";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";


/** GET /api/invoices/:id/tags — tags currently applied to one invoice. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json(
      { invoiceId: params.id, tags: getTags(params.id) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Tag fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tags",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/invoices/:id/tags — replace the invoice's tag set.
 *
 * The client sends the full desired list (both adds and removes go through
 * here), which keeps optimistic UI updates trivial to reconcile: the response
 * is the authoritative normalized set.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const rawBody = await request.json();
    const parsed = TagsPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid tags payload — expected { tags: string[] } with at most ${MAX_TAGS_PER_INVOICE} entries`,
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const tags = setTags(params.id, parsed.data.tags);

    return NextResponse.json({ success: true, invoiceId: params.id, tags }, { status: 200 });
  } catch (error) {
    console.error("Tag save error:", error);
    return NextResponse.json(
      {
        error: "Failed to persist tags",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
