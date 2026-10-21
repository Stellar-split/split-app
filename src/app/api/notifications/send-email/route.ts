import { NextRequest, NextResponse } from "next/server";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";

export const dynamic = "force-dynamic";

interface SendEmailBody {
  to?: string;
  subject?: string;
  message?: string;
  invoiceId?: string;
}

/**
 * POST /api/notifications/send-email
 *
 * Sends a transactional notification email via Resend.
 * Requires a valid CSRF token and a properly formed request body.
 *
 * When RESEND_API_KEY is not configured the request is acknowledged with
 * `skipped: true` so callers can degrade gracefully in dev/staging.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  let body: SendEmailBody;
  try {
    body = (await request.json()) as SendEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, message, invoiceId } = body;

  if (!to || !subject || !message) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject, message" },
      { status: 400 }
    );
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[Notifications] RESEND_API_KEY not set — email send skipped:", {
      to,
      subject,
      invoiceId,
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "Email service not configured" });
  }

  try {
    const fromAddress =
      process.env.EMAIL_FROM ?? "noreply@stellarsplit-dapp.vercel.app";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const invoiceLink = invoiceId
      ? `<p style="margin-top:16px"><a href="${appUrl}/invoice/${invoiceId}" style="color:#6366f1">View Invoice →</a></p>`
      : "";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:#fff;padding:24px;border-radius:8px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827">StellarSplit Notification</h2>
          <p style="margin:0 0 16px;color:#374151;line-height:1.6">${message.replace(/\n/g, "<br/>")}</p>
          ${invoiceLink}
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
          © ${new Date().getFullYear()} StellarSplit · Automated notification
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Notifications] Resend API error:", errText);
      return NextResponse.json({ error: "Email delivery failed" }, { status: 502 });
    }

    const data = (await res.json()) as { id?: string };
    return NextResponse.json({ ok: true, messageId: data.id });
  } catch (err) {
    console.error("[Notifications] Email send error:", err);
    return NextResponse.json({ error: "Internal error sending email" }, { status: 500 });
  }
}
