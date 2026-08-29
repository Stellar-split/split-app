import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getSplitClient } from "@/lib/stellar";
import { formatAmount } from "@stellar-split/sdk";

import { crossedMilestones, fundedPercent } from "@/lib/fundingThresholds";
import {

  getNotifiedMilestones,
  getSubscriptions,
  listTrackedInvoiceIds,
  markMilestoneNotified,
} from "@/lib/pushSubscriptionStore";
import { sendFundingMilestoneNotification } from "@/lib/webPush";


interface CheckResult {
  invoiceId: string;
  notifiedMilestones: number[];
}

async function checkInvoice(invoiceId: string): Promise<CheckResult> {
  const client = getSplitClient();
  const invoice = await client.getInvoice(invoiceId);
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const pct = fundedPercent(invoice.funded, total);
  const alreadyNotified = getNotifiedMilestones(invoiceId);
  const newMilestones = crossedMilestones(pct, alreadyNotified);

  if (newMilestones.length === 0) {
    return { invoiceId, notifiedMilestones: [] };
  }

  const remaining = total - invoice.funded;
  const subscriptions = getSubscriptions(invoiceId);

  for (const milestone of newMilestones) {
    markMilestoneNotified(invoiceId, milestone);
    await Promise.all(
      subscriptions.map((sub) =>
        sendFundingMilestoneNotification(sub, {
          invoiceId,
          milestone,
          invoiceTitle: `Invoice #${invoiceId}`,
          remainingLabel: `${formatAmount(remaining < 0n ? 0n : remaining)} USDC`,
        })
      )
    );
  }

  return { invoiceId, notifiedMilestones: newMilestones };
}

/** Called right after a confirmed payment to check that one invoice immediately. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const invoiceId = body?.invoiceId;
  if (typeof invoiceId !== "string" || !invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  try {
    const result = await checkInvoice(invoiceId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check funding thresholds" },
      { status: 500 }
    );
  }
}

/** Periodic sweep across every invoice with an active subscription, for a scheduled cron trigger. */
export async function GET() {
  const results: CheckResult[] = [];
  for (const invoiceId of listTrackedInvoiceIds()) {
    try {
      results.push(await checkInvoice(invoiceId));
    } catch {
      // Skip invoices that fail to load (e.g. transient RPC errors) this sweep.
    }
  }
  return NextResponse.json({ checked: results.length, results });
}
