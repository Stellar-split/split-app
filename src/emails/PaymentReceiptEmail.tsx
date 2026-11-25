/**
 * Payment Receipt Email Template
 *
 * React Email component for payment receipt emails sent after on-chain payment confirmation.
 * Can be rendered as HTML or used with email services like Resend.
 */

import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  recipientEmail: string;
  recipientName: string;
  paymentAmount: string;
  paymentAsset: string;
  transactionHash: string;
  payerAddress: string;
  paidAt: Date;
}

export default function PaymentReceiptEmail({
  invoice,
  recipientEmail,
  recipientName,
  paymentAmount,
  paymentAsset,
  transactionHash,
  payerAddress,
  paidAt,
}: Props) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(paidAt);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        backgroundColor: "#f9fafb",
        padding: "20px",
      }}
    >
      {/* Header */}
      <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "8px", marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 10px 0", fontSize: "28px", fontWeight: "700" }}>
          Payment Received ✓
        </h1>
        <p style={{ margin: "0", color: "#6b7280", fontSize: "14px" }}>
          Payment confirmation for Invoice #{invoice.id}
        </p>
      </div>

      {/* Main Content */}
      <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "8px", marginBottom: "20px" }}>
        <p style={{ margin: "0 0 20px 0", fontSize: "16px" }}>
          Hi {recipientName},
        </p>

        <p style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: "1.6" }}>
          We&apos;re confirming that we&apos;ve received your payment for Invoice #{invoice.id}. Thank you!
        </p>

        {/* Payment Summary Box */}
        <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "6px", marginBottom: "20px" }}>
          <table style={{ width: "100%", fontSize: "14px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "8px 0", color: "#6b7280" }}>Amount Paid:</td>
                <td style={{ padding: "8px 0", fontWeight: "600", textAlign: "right" }}>
                  {paymentAmount} {paymentAsset}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#6b7280" }}>Payment Time:</td>
                <td style={{ padding: "8px 0", fontWeight: "600", textAlign: "right" }}>
                  {formattedDate}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#6b7280" }}>From Address:</td>
                <td style={{ padding: "8px 0", fontWeight: "600", textAlign: "right", wordBreak: "break-all" }}>
                  {payerAddress}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: "12px 0 0 0", borderTop: "1px solid #e5e7eb" }} />
              </tr>
              <tr>
                <td style={{ padding: "12px 0 0 0", color: "#6b7280" }}>Transaction Hash:</td>
                <td style={{ padding: "12px 0 0 0" }}>
                  <code
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      wordBreak: "break-all",
                      fontWeight: "600",
                    }}
                  >
                    {transactionHash}
                  </code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Invoice Details */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600" }}>
            Invoice Details
          </h2>
          <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "8px", textAlign: "left", color: "#6b7280", fontWeight: "600" }}>
                  Description
                </th>
                <th style={{ padding: "8px", textAlign: "right", color: "#6b7280", fontWeight: "600" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.recipients.map((recipient, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px", color: "#374151" }}>
                    {recipient.address.slice(0, 8)}...{recipient.address.slice(-8)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", color: "#374151", fontWeight: "500" }}>
                    {(Number(recipient.amount) / 1e7).toFixed(2)} XLM
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: "20px 0 0 0", fontSize: "14px", color: "#6b7280", lineHeight: "1.6" }}>
          A PDF receipt has been attached to this email for your records. This transaction is now
          confirmed on the Stellar network and cannot be reversed.
        </p>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", color: "#6b7280", fontSize: "12px", padding: "20px 0" }}>
        <p style={{ margin: "0 0 8px 0" }}>
          This is an automated message from Split App. Please do not reply to this email.
        </p>
        <p style={{ margin: "0", opacity: "0.7" }}>
          © {new Date().getFullYear()} Stellar Split. All rights reserved.
        </p>
      </div>
    </div>
  );
}
