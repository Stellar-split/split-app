import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import type { Invoice, Payment } from "@stellar-split/sdk";
import {

  sendPaymentReceiptEmail,
  batchSendPaymentReceipts,
  formatAmountForEmail,
  type PaymentReceiptData,
} from "@/lib/paymentReceiptEmailer";

/**
 * POST /api/invoices/[id]/payment-confirmed
 *
 * Internal webhook triggered by payment confirmation on-chain.
 * Sends automated receipt emails to creator and recipients.
 *
 * Request body:
 * {
 *   invoice: Invoice,
 *   payment: Payment,
 *   transactionHash: string,
 *   paidAt: string (ISO 8601),
 *   creatorEmail?: string,
 *   recipientEmails?: Record<string, string> // address -> email
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const invoiceId = params.id;
    const body = await request.json();

    const {
      invoice,
      payment,
      transactionHash,
      paidAt,
      creatorEmail,
      recipientEmails = {},
    } = body as {
      invoice: Invoice;
      payment: Payment;
      transactionHash: string;
      paidAt: string;
      creatorEmail?: string;
      recipientEmails?: Record<string, string>;
    };

    // Validate inputs
    if (!invoice || !payment) {
      return NextResponse.json(
        { error: "Missing invoice or payment data" },
        { status: 400 },
      );
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: "Missing transaction hash" },
        { status: 400 },
      );
    }

    const paidDate = new Date(paidAt);

    // Prepare receipt emails to send
    const emailsToSend: PaymentReceiptData[] = [];

    // Add creator receipt if email available
    if (creatorEmail) {
      emailsToSend.push({
        invoiceId,
        recipientEmail: creatorEmail,
        recipientName: "Creator",
        recipientAddress: invoice.creator,
        paymentAmount: formatAmountForEmail(payment.amount),
        paymentAsset: "XLM",
        transactionHash,
        payerAddress: payment.payer,
        paidAt: paidDate,
      });
    }

    // Add recipient receipts if emails available
    for (const recipient of invoice.recipients) {
      const email = recipientEmails[recipient.address];
      if (email) {
        emailsToSend.push({
          invoiceId,
          recipientEmail: email,
          recipientName: recipient.address.slice(0, 8) + "...",
          recipientAddress: recipient.address,
          paymentAmount: formatAmountForEmail(recipient.amount),
          paymentAsset: "XLM",
          transactionHash,
          payerAddress: payment.payer,
          paidAt: paidDate,
        });
      }
    }

    // Send all receipts
    let results;
    if (emailsToSend.length === 1) {
      results = [await sendPaymentReceiptEmail(emailsToSend[0])];
    } else {
      results = await batchSendPaymentReceipts(emailsToSend);
    }

    // Check if any succeeded
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Log audit trail
    console.log(
      `[PaymentConfirmed] Invoice ${invoiceId}: ${successCount} emails sent, ${failureCount} failed`,
      {
        transactionHash,
        recipients: emailsToSend.length,
      },
    );

    return NextResponse.json(
      {
        success: true,
        invoiceId,
        transactionHash,
        emailsSent: successCount,
        emailsFailed: failureCount,
        details: results,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Payment confirmation webhook error:", error);
    return NextResponse.json(
      {
        error: "Failed to process payment confirmation",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/invoices/[id]/payment-confirmed
 *
 * Health check endpoint to verify webhook is accessible
 */
export async function GET() {
  return NextResponse.json(
    { message: "Payment confirmation endpoint ready" },
    { status: 200 },
  );
}
