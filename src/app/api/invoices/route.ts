import { NextRequest, NextResponse } from "next/server";
import { splitClient } from "@/lib/stellar";

const PAGE_SIZE = 20;

/**
 * GET /api/invoices?cursor=<id>&limit=20&publicKey=<address>
 *
 * Cursor-paginated invoice list. `cursor` is the exclusive lower bound —
 * the first page omits it, subsequent pages pass the last invoice id returned.
 *
 * Response shape:
 *   { invoices: Invoice[], nextCursor: string | null }
 *
 * `nextCursor` is null when there are no further pages.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const publicKey = searchParams.get("publicKey");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  if (!publicKey) {
    return NextResponse.json(
      { error: "publicKey query parameter is required" },
      { status: 400 },
    );
  }

  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    50,
  );

  // Determine starting invoice id (cursor is the last id we already returned)
  const startId = cursorParam ? parseInt(cursorParam, 10) + 1 : 1;

  const results = [];
  let lastCheckedId = startId - 1;

  for (let id = startId; results.length < limit; id++) {
    // Safety cap — don't scan more than limit*10 ids in a single request
    if (id > startId + limit * 10) break;

    lastCheckedId = id;

    try {
      const inv = await splitClient.getInvoice(String(id));
      const mine =
        inv.creator === publicKey ||
        inv.recipients.some((r) => r.address === publicKey);
      if (mine) {
        results.push(inv);
      }
    } catch {
      // splitClient throws when invoice id does not exist — treat as end of list
      return NextResponse.json(
        { invoices: results, nextCursor: null },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
  }

  // If we filled the page we don't know yet whether there are more — return the
  // id of the last invoice we fetched so the client can continue from there.
  const nextCursor =
    results.length === limit ? String(results[results.length - 1].id) : null;

  return NextResponse.json(
    { invoices: results, nextCursor },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
