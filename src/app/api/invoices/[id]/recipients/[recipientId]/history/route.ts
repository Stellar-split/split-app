import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { splitClient } from "@/lib/stellar";

/**
 * GET /api/invoices/[id]/recipients/[recipientId]/history
 *
 * Returns on-chain payment history for a specific recipient on an invoice.
 * Queries the invoice's payment list (via the SDK / Horizon) and filters to
 * operations that transferred funds to `recipientId`.
 *
 * Results are cached with short-lived headers so repeated expands on the same
 * page session stay fast without stale data.
 */

export interface RecipientHistoryEntry {
  /** Stellar operation/transaction hash */
  operationHash: string;
  /** Amount transferred (string to preserve decimal precision) */
  amount: string;
  /** Asset code, e.g. "XLM" or "USDC" */
  asset: string;
  /** ISO-8601 timestamp of the operation */
  timestamp: string;
  /** Sender address (typically the escrow or payer) */
  from: string;
}

export interface RecipientHistoryResponse {
  recipientId: string;
  invoiceId: string;
  entries: RecipientHistoryEntry[];
  cursor: string | null;
}

const DEFAULT_LIMIT = 20;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; recipientId: string } }
) {
  const { id: invoiceId, recipientId } = params;
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    50
  );

  try {
    const invoice = await splitClient.getInvoice(invoiceId);

    // Verify the recipientId is actually a recipient on this invoice.
    const recipientExists = invoice.recipients.some(
      (r) => r.address === recipientId
    );
    if (!recipientExists) {
      return NextResponse.json(
        { error: "Recipient not found on this invoice" },
        { status: 404 }
      );
    }

    // Filter payments to those destined for this recipient.
    // The SDK payment objects contain payer (from), amount, and an optional
    // timestamp. We adapt them to the richer RecipientHistoryEntry shape.
    const allPayments: RecipientHistoryEntry[] = invoice.payments
      .filter((p) => {
        // The SDK Payment type includes a `recipient` field on some builds;
        // fall back to checking whether the to-address matches recipientId.
        const payment = p as unknown as Record<string, unknown>;
        return (
          payment.recipient === recipientId ||
          payment.to === recipientId ||
          // If there is no per-payment recipient field the whole invoice
          // payment list belongs to a single-recipient invoice.
          (invoice.recipients.length === 1 &&
            invoice.recipients[0].address === recipientId)
        );
      })
      .map((p, idx) => {
        const payment = p as unknown as Record<string, unknown>;
        const ts = payment.timestamp;
        const tsMs =
          typeof ts === "number"
            ? ts * 1000
            : typeof ts === "string"
              ? Date.parse(ts)
              : NaN;
        return {
          operationHash: String(
            payment.txHash ?? payment.operationHash ?? `op-${invoiceId}-${idx}`
          ),
          amount: String(payment.amount ?? "0"),
          asset: String(payment.asset ?? "XLM"),
          timestamp: Number.isNaN(tsMs)
            ? new Date().toISOString()
            : new Date(tsMs).toISOString(),
          from: String(
            payment.payer ?? payment.from ?? invoice.creator ?? ""
          ),
        };
      });

    // Apply cursor-based pagination.
    const startIdx = cursor ? parseInt(cursor, 10) : 0;
    const page = allPayments.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < allPayments.length
        ? String(startIdx + limit)
        : null;

    return NextResponse.json(
      {
        recipientId,
        invoiceId,
        entries: page,
        cursor: nextCursor,
      } satisfies RecipientHistoryResponse,
      {
        headers: {
          // Short private cache — same user re-expands without a new RTT,
          // but data stays fresh after ~30 s.
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (error) {
    console.error("Recipient history fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipient payment history" },
      { status: 500 }
    );
  }
}
