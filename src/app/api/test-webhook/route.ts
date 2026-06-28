import { NextRequest, NextResponse } from "next/server";
import { requireWriteScope } from "@/lib/apiKeyAuth";

const SAMPLE_PAYLOADS: Record<string, object> = {
  "invoice.created": {
    event: "invoice.created",
    invoiceId: "INV-SAMPLE-001",
    creator: "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX",
    totalAmount: "100.0000000",
    token: "USDC",
    deadline: Math.floor(Date.now() / 1000) + 86400 * 7,
    timestamp: new Date().toISOString(),
  },
  "invoice.paid": {
    event: "invoice.paid",
    invoiceId: "INV-SAMPLE-001",
    payer: "GDDKQF3XIMJ6YUJKAVZNHKGKJHGKJHKAVZNHKGKJHGKJHKAVZNHKGKJ",
    amount: "50.0000000",
    txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    timestamp: new Date().toISOString(),
  },
  "invoice.released": {
    event: "invoice.released",
    invoiceId: "INV-SAMPLE-001",
    totalFunded: "100.0000000",
    previousStatus: "Pending",
    newStatus: "Released",
    timestamp: new Date().toISOString(),
  },
  "invoice.refunded": {
    event: "invoice.refunded",
    invoiceId: "INV-SAMPLE-001",
    reason: "Deadline passed",
    previousStatus: "Pending",
    newStatus: "Refunded",
    timestamp: new Date().toISOString(),
  },
};

export async function POST(req: NextRequest) {
  const authError = requireWriteScope(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const { url, eventType } = body as { url: string; eventType?: string };
  const payload = SAMPLE_PAYLOADS[eventType ?? ""] ?? SAMPLE_PAYLOADS["invoice.created"];
  const start = Date.now();

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Source": "split-app-tester",
        "X-Webhook-Event": eventType ?? "invoice.created",
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - start;
    const responseBody = await upstream.text();
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => { responseHeaders[key] = value; });

    return NextResponse.json({ status: upstream.status, headers: responseHeaders, body: responseBody, latencyMs, sentPayload: payload });
  } catch (err) {
    return NextResponse.json({ error: String(err), latencyMs: Date.now() - start }, { status: 502 });
  }
}
