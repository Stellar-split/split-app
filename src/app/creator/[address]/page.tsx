import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import CreatorProfileClient from "./CreatorProfileClient";

interface Props {
  params: { address: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = params;
  const short = truncateAddress(address);
  const title = `${short} — StellarSplit Creator`;
  const description = `View ${short}'s public invoice history and stats on StellarSplit.`;
  const ogUrl = `/creator/${address}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/creator/${address}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function CreatorPage({ params }: Props) {
  noStore();
  const { address } = params;

  let invoices: Invoice[] = [];
  try {
    // getInvoicesByCreator not yet in published SDK types; attempt via cast
    invoices = await (splitClient as any).getInvoicesByCreator(address);
  } catch {
    // SDK doesn't expose this yet — show empty state
  }

  const released = invoices.filter((inv) => inv.status === "Released");
  const totalVolume = released.reduce(
    (sum, inv) => sum + inv.recipients.reduce((s, r) => s + r.amount, 0n),
    0n
  );
  const completionRate =
    invoices.length === 0
      ? 0
      : Math.round((released.length / invoices.length) * 100);

  const publicInvoices = invoices.map((inv) => ({
    id: inv.id,
    status: inv.status,
    total: inv.recipients.reduce((s, r) => s + r.amount, 0n),
    funded: inv.funded,
    deadline: inv.deadline,
  }));

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <CreatorProfileClient
        address={address}
        totalInvoices={invoices.length}
        totalVolume={formatAmount(totalVolume)}
        completionRate={completionRate}
        invoices={publicInvoices}
      />
    </main>
  );
}
