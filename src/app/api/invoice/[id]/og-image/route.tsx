import { NextRequest, NextResponse } from "next/server";
import { splitClient, formatAmount } from "@stellar-split/sdk";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app");

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoice = await splitClient.getInvoice(params.id);
    const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
    const pct = total === 0n ? 0 : Number((invoice.funded * 100n) / total);

    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2d3748;stop-opacity:1" />
        </linearGradient>
      </defs>

      <rect width="1200" height="630" fill="url(#grad)"/>

      <text x="60" y="120" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">
        Invoice #${params.id}
      </text>

      <text x="60" y="180" font-family="Arial, sans-serif" font-size="32" fill="#a0aec0">
        ${formatAmount(total)} USDC
      </text>

      <rect x="60" y="220" width="1080" height="40" rx="20" fill="#1a202c"/>
      <rect x="60" y="220" width="${1080 * (pct / 100)}" height="40" rx="20" fill="#10b981"/>

      <text x="60" y="300" font-family="Arial, sans-serif" font-size="24" fill="#a0aec0">
        Status: ${invoice.status}
      </text>

      <text x="60" y="340" font-family="Arial, sans-serif" font-size="20" fill="#a0aec0">
        ${pct.toFixed(0)}% Funded • ${formatAmount(invoice.funded)} Received
      </text>

      <text x="60" y="570" font-family="Arial, sans-serif" font-size="18" fill="#718096">
        View on StellarSplit
      </text>
    </svg>`;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("OG image generation error:", error);

    const fallbackSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#1a202c"/>
      <text x="600" y="315" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
        StellarSplit Invoice
      </text>
    </svg>`;

    return new NextResponse(fallbackSvg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
