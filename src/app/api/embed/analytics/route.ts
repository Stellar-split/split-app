import { NextRequest, NextResponse } from "next/server";
import { splitClient } from "@/lib/stellar";
import { verifyEmbedAnalyticsToken } from "@/lib/embedAnalyticsToken";
import { recordEmbedUsage } from "@/app/api/embed/usageStore";
import { getEmbedAnalyticsSigningSecret } from "@/lib/embedAnalyticsSecret";

export const dynamic = "force-dynamic";

function createdAt(invoice: { createdAt?: number; deadline: number }): number {
  return invoice.createdAt ?? invoice.deadline - 7 * 24 * 60 * 60;
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-embed-token");
  const claims = token ? verifyEmbedAnalyticsToken(token, getEmbedAnalyticsSigningSecret()) : null;
  if (!claims) return NextResponse.json({ error: "Embed token is invalid or expired." }, { status: 401 });
  if (request.nextUrl.searchParams.get("creator") !== claims.creator) {
    return NextResponse.json({ error: "Embed token does not grant access to this creator." }, { status: 403 });
  }

  const suppliedOrigin = request.headers.get("x-embed-parent-origin");
  if (claims.origin && suppliedOrigin !== claims.origin) {
    return NextResponse.json({ error: "This embed token is not valid for this origin." }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const range = request.nextUrl.searchParams.get("range") ?? "all";
  if (!new Set(["all", "Pending", "Released", "Refunded"]).has(status)) {
    return NextResponse.json({ error: "Unsupported status filter." }, { status: 400 });
  }
  if (!new Set(["all", "30d", "90d", "365d"]).has(range)) {
    return NextResponse.json({ error: "Unsupported date range filter." }, { status: 400 });
  }

  try {
    const invoices = [];
    let offset = 0;
    while (offset < 10_000) {
      const batch = await (splitClient as any).getInvoicesByCreator(claims.creator, offset, 100);
      if (!Array.isArray(batch) || batch.length === 0) break;
      invoices.push(...batch);
      offset += batch.length;
      if (batch.length < 100) break;
    }
    const earliest = range === "all" ? 0 : Date.now() / 1000 - Number.parseInt(range, 10) * 24 * 60 * 60;
    const filtered = invoices.filter((invoice) =>
      (status === "all" || invoice.status === status) && createdAt(invoice) >= earliest,
    );
    const raised = filtered.reduce((sum, invoice) => sum + Number(invoice.funded ?? 0n), 0);
    const target = filtered.reduce((sum, invoice) =>
      sum + invoice.recipients.reduce((recipientSum: number, recipient: { amount: bigint }) => recipientSum + Number(recipient.amount), 0),
    0);
    const statusCounts = filtered.reduce((counts: Record<string, number>, invoice) => {
      counts[invoice.status] = (counts[invoice.status] ?? 0) + 1;
      return counts;
    }, {});
    const daily = new Map<string, number>();
    filtered.forEach((invoice) => {
      const day = new Date(createdAt(invoice) * 1000).toISOString().slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + Number(invoice.funded ?? 0n));
    });
    const result = {
      creator: claims.creator,
      generatedAt: Date.now(),
      filters: { status, range },
      summary: {
        invoiceCount: filtered.length,
        activeInvoices: filtered.filter((invoice) => invoice.status === "Pending").length,
        paymentCount: filtered.reduce((sum, invoice) => sum + invoice.payments.length, 0),
        fundedStroops: raised,
        targetStroops: target,
        completionRate: target > 0 ? Math.min(100, raised / target * 100) : 0,
      },
      statuses: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      daily: Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, fundedStroops]) => ({ date, fundedStroops })),
    };
    recordEmbedUsage({ creator: claims.creator, tokenId: claims.tokenId, timestamp: Date.now() });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load creator analytics." }, { status: 502 });
  }
}