import { NextRequest, NextResponse } from "next/server";
import { addSubscription, removeSubscription, type StoredPushSubscription } from "@/lib/pushSubscriptionStore";

function isValidSubscription(value: unknown): value is StoredPushSubscription {
  if (!value || typeof value !== "object") return false;
  const sub = value as Record<string, unknown>;
  if (typeof sub.endpoint !== "string") return false;
  const keys = sub.keys as Record<string, unknown> | undefined;
  return Boolean(keys && typeof keys.p256dh === "string" && typeof keys.auth === "string");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const invoiceId = body?.invoiceId;
  const subscription = body?.subscription;

  if (typeof invoiceId !== "string" || !invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }
  if (!isValidSubscription(subscription)) {
    return NextResponse.json({ error: "A valid PushSubscription is required" }, { status: 400 });
  }

  addSubscription(invoiceId, subscription);
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const invoiceId = body?.invoiceId;
  const endpoint = body?.endpoint;

  if (typeof invoiceId !== "string" || typeof endpoint !== "string") {
    return NextResponse.json({ error: "invoiceId and endpoint are required" }, { status: 400 });
  }

  removeSubscription(invoiceId, endpoint);
  return NextResponse.json({ subscribed: false });
}
