import type { Metadata } from "next";
import { splitClient } from "@/lib/stellar";
import { formatAmount } from "@stellar-split/sdk";

interface Props {
  params: { id: string };
}

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  try {
    const invoice = await splitClient.getInvoice(id);
    const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
    const pct = total === 0n ? 0 : Number((invoice.funded * 100n) / total);
    const title = `Invoice #${id} — ${invoice.status} | StellarSplit`;
    const description = `${pct}% funded · ${formatAmount(invoice.funded)} / ${formatAmount(total)} USDC · Status: ${invoice.status}`;
    const url = `${appUrl}/verify/${id}`;
    return {
      title,
      description,
      openGraph: { title, description, url, siteName: "StellarSplit", type: "website" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return { title: `Invoice #${id} | StellarSplit` };
  }
}

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
