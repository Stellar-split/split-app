import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { splitClient } from "@/lib/stellar";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

/**
 * In-memory store for manually-marked installment payments.
 * Keyed by `${invoiceId}:${index}`.
 *
 * In production this would be persisted in a database.
 */
const markedPaidStore = new Map<string, { paidAt: string; markedBy: string }>();

/**
 * POST /api/invoices/[id]/installments/[index]/mark-paid
 *
 * Marks a specific installment index as paid for the given invoice.
 * The caller must be the invoice creator or a recipient, identified by the
 * `x-wallet-public-key` request header.
 *
 * #615: Persists the off-chain "mark as paid" override so InstallmentTracker
 * can reflect the updated status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; index: string } }
) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  const invoiceId = params.id;
  const indexStr = params.index;

  // Validate index
  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 0) {
    return NextResponse.json(
      { error: "Invalid installment index" },
      { status: 400 }
    );
  }

  // Require wallet public key for authorization
  const walletPublicKey = request.headers.get("x-wallet-public-key");
  if (!walletPublicKey) {
    return NextResponse.json(
      { error: "Missing x-wallet-public-key header" },
      { status: 403 }
    );
  }

  // Verify the caller is the invoice creator or a recipient
  let invoice;
  try {
    invoice = await splitClient.getInvoice(invoiceId);
  } catch {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const isCreator = invoice.creator === walletPublicKey;
  const isRecipient = invoice.recipients.some(
    (r: { address: string }) => r.address === walletPublicKey
  );

  if (!isCreator && !isRecipient) {
    return NextResponse.json(
      { error: "Not authorised to update this invoice" },
      { status: 403 }
    );
  }

  const storeKey = `${invoiceId}:${index}`;

  if (markedPaidStore.has(storeKey)) {
    return NextResponse.json(
      { error: "Installment already marked as paid" },
      { status: 409 }
    );
  }

  const record = { paidAt: new Date().toISOString(), markedBy: walletPublicKey };
  markedPaidStore.set(storeKey, record);

  return NextResponse.json(
    {
      success: true,
      invoiceId,
      index,
      ...record,
    },
    { status: 200 }
  );
}

/**
 * GET /api/invoices/[id]/installments/[index]/mark-paid
 *
 * Returns the mark-paid record for this installment if it exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; index: string } }
) {
  const storeKey = `${params.id}:${params.index}`;
  const record = markedPaidStore.get(storeKey);

  if (!record) {
    return NextResponse.json({ paid: false }, { status: 200 });
  }

  return NextResponse.json({ paid: true, ...record }, { status: 200 });
}
