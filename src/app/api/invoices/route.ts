import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { fetchInvoicesForAddress } from "@/lib/stellar/horizonServer";

/**
 * GET /api/invoices?cursor=<id>&limit=20&publicKey=<address>&q=<query>
 *
 * Cursor-paginated invoice list. `cursor` is the exclusive lower bound —
 * the first page omits it, subsequent pages pass the last invoice id returned.
 *
 * With `q` parameter, performs case-insensitive prefix matching on title and memo.
 *
 * Response shape:
 *   { invoices: Invoice[], nextCursor: string | null }
 *
 * `nextCursor` is null when there are no further pages.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const publicKey = searchParams.get("publicKey");
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const q = searchParams.get("q") ?? undefined;

  if (!publicKey) {
    return NextResponse.json(
      { error: "publicKey query parameter is required" },
      { status: 400 },
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const result = await fetchInvoicesForAddress(publicKey, { cursor, limit, q });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
