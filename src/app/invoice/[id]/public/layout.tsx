import type { Metadata } from "next";
import { splitClient, formatAmount } from "@stellar-split/sdk";

interface Props {
  params: { id: string };
}

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  const url = `${appUrl}/invoice/${id}/public`;

  try {
    const invoice = await splitClient.getInvoice(id);
    const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
    const pct = total === 0n ? 0 : Number((invoice.funded * 100n) / total);

    const title = `Invoice #${id} — StellarSplit`;
    const description = `${pct}% funded · ${formatAmount(invoice.funded)} / ${formatAmount(total)} USDC · Status: ${invoice.status}`;

    return {
      title,
      description,
      robots: invoice.status === "Draft" ? { index: false } : undefined,
      openGraph: {
        title,
        description,
        url,
        siteName: "StellarSplit",
        type: "website",
        images: [
          {
            url: `${appUrl}/api/invoice/${id}/og-image`,
            width: 1200,
            height: 630,
            alt: `Invoice #${id}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`${appUrl}/api/invoice/${id}/og-image`],
      },
    };
  } catch {
    return {
      title: `Invoice #${id} | StellarSplit`,
      description: "View this invoice on StellarSplit",
      openGraph: {
        title: `Invoice #${id}`,
        url,
        siteName: "StellarSplit",
        type: "website",
      },
    };
  }
}

export default function PublicInvoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
