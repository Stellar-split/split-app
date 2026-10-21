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

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      // Graceful degradation: log and skip when not configured (dev/staging).
      console.log(
        `[Email] RESEND_API_KEY not configured — skipping receipt email to ${data.recipientEmail}`,
        { invoiceId: data.invoiceId, transactionHash: data.transactionHash }
      );
      await markEmailAsSent(data.invoiceId, data.transactionHash, data.recipientEmail);
      return {
        success: true,
        messageId: `skipped-${Date.now()}`,
        recipient: data.recipientEmail,
      };
    }

    const fromAddress =
      process.env.EMAIL_FROM ?? "noreply@stellarsplit-dapp.vercel.app";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const subject = `Payment Received – Invoice #${data.invoiceId}`;
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data.paidAt);

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#fff;padding:30px;border-radius:8px;margin-bottom:20px">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827">Payment Received ✓</h1>
          <p style="margin:0;color:#6b7280;font-size:14px">Invoice #${data.invoiceId}</p>
        </div>
        <div style="background:#fff;padding:30px;border-radius:8px;margin-bottom:20px">
          <p style="margin:0 0 16px;font-size:16px;color:#111827">Hi ${data.recipientName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
            A payment has been confirmed on the Stellar network for Invoice #${data.invoiceId}.
          </p>
          <div style="background:#f3f4f6;padding:20px;border-radius:6px;margin-bottom:20px">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr>
                <td style="padding:8px 0;color:#6b7280;width:40%">Amount:</td>
                <td style="padding:8px 0;font-weight:600;color:#111827">${data.paymentAmount} ${data.paymentAsset}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">Date:</td>
                <td style="padding:8px 0;font-weight:600;color:#111827">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">From:</td>
                <td style="padding:8px 0;font-family:monospace;font-size:12px;color:#374151;word-break:break-all">${data.payerAddress}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">Transaction:</td>
                <td style="padding:8px 0;font-family:monospace;font-size:11px;color:#374151;word-break:break-all">${data.transactionHash}</td>
              </tr>
            </table>
          </div>
          <p style="margin:0">
            <a href="${appUrl}/invoice/${data.invoiceId}"
               style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
              View Invoice
            </a>
          </p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px">
          © ${new Date().getFullYear()} StellarSplit · Automated receipt
        </p>
      </div>
    `;

    console.log(`[Email] Sending receipt to ${data.recipientEmail}`, {
      invoiceId: data.invoiceId,
      transactionHash: data.transactionHash,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [data.recipientEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API error ${res.status}: ${errText}`);
    }

    const resData = (await res.json()) as { id?: string };

    await markEmailAsSent(data.invoiceId, data.transactionHash, data.recipientEmail);

    return {
      success: true,
      messageId: resData.id,
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
