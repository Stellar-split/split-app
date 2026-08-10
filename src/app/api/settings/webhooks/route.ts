import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import crypto from "crypto";
import { webhookStore, ALL_EVENTS, type WebhookEndpoint, type WebhookEventType } from "./store";

import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

function generateSecret() {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

export function GET() {
  // Strip secretHash before sending to client
  const safeList = webhookStore.map(({ secretHash: _s, ...rest }) => rest);
  return NextResponse.json(safeList);
}

export async function POST(req: NextRequest) {
  const csrfError = await assertCsrf(req);
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);

  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const events: WebhookEventType[] = Array.isArray(body.events) ? body.events : [];
  const validEvents = events.filter((e): e is WebhookEventType => ALL_EVENTS.includes(e));
  if (validEvents.length === 0) {
    return NextResponse.json({ error: "At least one event type is required" }, { status: 400 });
  }

  const secret = generateSecret();
  const endpoint: WebhookEndpoint = {
    id: crypto.randomUUID(),
    url: body.url,
    events: validEvents,
    status: "active",
    createdAt: new Date().toISOString(),
    secretHash: crypto.createHash("sha256").update(secret).digest("hex"),
  };

  webhookStore.push(endpoint);

  const { secretHash: _s, ...safe } = endpoint;
  // Return secret only once on creation
  return NextResponse.json({ ...safe, secret }, { status: 201 });
}
