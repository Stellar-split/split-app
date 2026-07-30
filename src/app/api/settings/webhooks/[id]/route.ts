import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { webhookStore } from "../store";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

/** DELETE /api/settings/webhooks/:id — remove a webhook endpoint */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = await assertCsrf(req);
  if (csrfError) return csrfError;

  const idx = webhookStore.findIndex((w) => w.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  webhookStore.splice(idx, 1);
  return new NextResponse(null, { status: 204 });
}

/** POST /api/settings/webhooks/:id/rotate — generate a new HMAC secret */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = await assertCsrf(req);
  if (csrfError) return csrfError;

  const endpoint = webhookStore.find((w) => w.id === params.id);
  if (!endpoint) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  endpoint.secretHash = crypto.createHash("sha256").update(secret).digest("hex");

  const { secretHash: _s, ...safe } = endpoint;
  return NextResponse.json({ ...safe, secret });
}
