import { NextRequest, NextResponse } from "next/server";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  let totalInvoices = 0;
  let totalVolume = "0";
  let completionRate = 0;

  try {
    const invoices: Invoice[] = await (splitClient as any).getInvoicesByCreator(address);
    const released = invoices.filter((inv) => inv.status === "Released");
    const volume = released.reduce(
      (sum, inv) => sum + inv.recipients.reduce((s, r) => s + r.amount, 0n),
      0n
    );
    totalInvoices = invoices.length;
    totalVolume = formatAmount(volume);
    completionRate =
      invoices.length === 0
        ? 0
        : Math.round((released.length / invoices.length) * 100);
  } catch {}

  const short = truncateAddress(address);

  // Return an SVG-based OG image
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#030712"/>
  <rect x="0" y="0" width="1200" height="6" fill="#4f46e5"/>
  <text x="80" y="120" font-family="ui-monospace,monospace" font-size="28" fill="#6366f1">✦ StellarSplit</text>
  <text x="80" y="230" font-family="ui-sans-serif,system-ui,sans-serif" font-size="52" font-weight="bold" fill="#f9fafb">${short}</text>
  <text x="80" y="290" font-family="ui-monospace,monospace" font-size="22" fill="#6b7280">Creator Profile</text>
  <rect x="80" y="350" width="300" height="120" rx="12" fill="#111827"/>
  <text x="230" y="415" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="36" font-weight="bold" fill="#f9fafb">${totalInvoices}</text>
  <text x="230" y="450" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="14" fill="#9ca3af">Invoices</text>
  <rect x="420" y="350" width="300" height="120" rx="12" fill="#111827"/>
  <text x="570" y="408" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="28" font-weight="bold" fill="#f9fafb">${totalVolume}</text>
  <text x="570" y="430" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="12" fill="#6366f1">USDC</text>
  <text x="570" y="455" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="14" fill="#9ca3af">Total Raised</text>
  <rect x="760" y="350" width="300" height="120" rx="12" fill="#111827"/>
  <text x="910" y="415" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="36" font-weight="bold" fill="#f9fafb">${completionRate}%</text>
  <text x="910" y="450" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="14" fill="#9ca3af">Completion Rate</text>
  <text x="80" y="560" font-family="ui-sans-serif,sans-serif" font-size="18" fill="#4b5563">splitapp-steel.vercel.app</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
