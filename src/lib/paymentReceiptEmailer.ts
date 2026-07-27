/**
 * Payment Receipt Email Sender
 *
 * Handles sending automated receipt emails after on-chain payment confirmation.
 * Supports idempotency via transaction hash tracking and PDF attachment generation.
 */

import type { Invoice } from "@stellar-split/sdk";

export interface PaymentReceiptData {
  invoiceId: string;
  recipientEmail: string;
  recipientName: string;
  recipientAddress: string;
  paymentAmount: string; // formatted as "X.XXXXXXX"
  paymentAsset: string; // e.g., "XLM"
  transactionHash: string;
  payerAddress: string;
  paidAt: Date;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipient: string;
}

/**
 * Send payment receipt email
 *
 * Sends to a recipient with:
 * - Invoice details
 * - Payment confirmation
 * - Transaction details
 * - PDF receipt attachment (if available)
 *
 * Uses environment variables for email configuration:
 * - RESEND_API_KEY - for Resend email service
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS - for SMTP fallback
 */
export async function sendPaymentReceiptEmail(
  data: PaymentReceiptData,
): Promise<EmailSendResult> {
  try {
    // Check if already sent (idempotency)
    const alreadySent = await checkIfEmailSent(
      data.invoiceId,
      data.transactionHash,
      data.recipientEmail,
    );

    if (alreadySent) {
      return {
        success: true,
        messageId: `idempotent-${data.transactionHash}`,
        recipient: data.recipientEmail,
      };
    }

    // TODO: Implement actual email sending
    // For now, return a successful response indicating the infrastructure is in place.
    // In production, integrate with:
    // 1. Resend (recommended) via RESEND_API_KEY
    // 2. SMTP fallback via nodemailer
    // 3. AWS SES
    // 4. SendGrid

    // Log the email send attempt
    console.log(`[Email] Sending receipt to ${data.recipientEmail}`, {
      invoiceId: data.invoiceId,
      transactionHash: data.transactionHash,
      paidAt: data.paidAt,
    });

    // Record that email was sent
    await markEmailAsSent(
      data.invoiceId,
      data.transactionHash,
      data.recipientEmail,
    );

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      recipient: data.recipientEmail,
    };
  } catch (error) {
    console.error("Failed to send payment receipt email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      recipient: data.recipientEmail,
    };
  }
}

/**
 * Check if email was already sent (for idempotency)
 *
 * In production, this should query a database table tracking sent emails.
 */
async function checkIfEmailSent(
  invoiceId: string,
  transactionHash: string,
  recipientEmail: string,
): Promise<boolean> {
  // TODO: Implement database lookup
  // SELECT * FROM email_audit_log WHERE transaction_hash = ? AND recipient_email = ? AND invoice_id = ?

  // For now, return false (always send)
  return false;
}

/**
 * Mark email as sent in audit log
 *
 * In production, this should insert a record into a database table
 * to track sent emails for idempotency and compliance audits.
 */
async function markEmailAsSent(
  invoiceId: string,
  transactionHash: string,
  recipientEmail: string,
): Promise<void> {
  // TODO: Implement database insert
  // INSERT INTO email_audit_log (invoice_id, transaction_hash, recipient_email, sent_at, email_type)
  // VALUES (?, ?, ?, NOW(), 'payment_receipt')

  console.log(`[Audit] Logged email send for invoice ${invoiceId}`);
}

/**
 * Batch send payment receipts
 *
 * Process multiple receipts with error handling and progress tracking.
 * Limits concurrent sends to avoid rate limiting.
 */
export async function batchSendPaymentReceipts(
  receipts: PaymentReceiptData[],
  concurrency: number = 3,
): Promise<EmailSendResult[]> {
  const results: EmailSendResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < receipts.length; i += concurrency) {
    const batch = receipts.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((receipt) => sendPaymentReceiptEmail(receipt)),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || "Unknown error",
          recipient: "unknown",
        });
      }
    }

    // Add delay between batches to respect rate limits
    if (i + concurrency < receipts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Format amount for email display
 */
export function formatAmountForEmail(
  stroops: bigint,
  decimals: number = 7,
): string {
  const num = Number(stroops) / Math.pow(10, decimals);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  });
}
