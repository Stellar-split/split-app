import { NextRequest, NextResponse } from "next/server";
import { requireWriteScope } from "@/lib/apiKeyAuth";

interface ConfirmationRequest {
  email: string;
  invoiceId: string;
  txHash: string;
  amount: string;
}

export async function POST(request: NextRequest) {
  const authError = requireWriteScope(request);
  if (authError) return authError;

  try {
    const body: ConfirmationRequest = await request.json();
    const { email, invoiceId, txHash, amount } = body;

    // Skip if email is empty
    if (!email || !email.trim()) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app");

    const verifyUrl = `${appUrl}/verify/${invoiceId}`;

    // Email content
    const emailHtml = `
      <h2>Payment Confirmation</h2>
      <p>Your payment has been successfully confirmed on-chain.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice ID</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">#${invoiceId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${amount} USDC</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Transaction Hash</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><code>${txHash}</code></td>
        </tr>
      </table>
      <p><a href="${verifyUrl}">View Invoice Details</a></p>
    `;

    const emailText = `
Payment Confirmation

Your payment has been successfully confirmed on-chain.

Invoice ID: #${invoiceId}
Amount: ${amount} USDC
Transaction Hash: ${txHash}

View Invoice Details: ${verifyUrl}
    `;

    // For now, log the email (in production, integrate with Resend or Nodemailer)
    console.log(`[Email] To: ${email}, Invoice: #${invoiceId}, Amount: ${amount} USDC`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500 }
    );
  }
}
