import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

/**
 * Accepts an uploaded invoice draft once the browser is back online. There's
 * no database in this project, so this just acknowledges receipt — the
 * client is the source of truth and clears its local IndexedDB copy on a
 * successful response.
 */
export async function POST(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const draftId = body?.draftId;
  const userId = body?.userId;
  const data = body?.data;

  if (typeof draftId !== "string" || !draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  return NextResponse.json({ received: true, draftId });
}
