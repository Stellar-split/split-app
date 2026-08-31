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

/**
 * Reports the server's last-known `updatedAt` for a draft, so the client can
 * detect a conflict before overwriting it. There's no database in this
 * project, so there's never a stored server version — the client treats a
 * missing `updatedAt` as "no conflict" and syncs normally.
 */
export async function GET(request: NextRequest) {
  const draftId = request.nextUrl.searchParams.get("draftId");
  const userId = request.nextUrl.searchParams.get("userId");

  if (!draftId || !userId) {
    return NextResponse.json({ error: "draftId and userId are required" }, { status: 400 });
  }

  return NextResponse.json({ updatedAt: null });
}
