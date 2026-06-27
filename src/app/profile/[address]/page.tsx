import { unstable_noStore as noStore } from "next/cache";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import ProfileClient from "./ProfileClient";

interface Props {
  params: { address: string };
}

export default async function ProfilePage({ params }: Props) {
  noStore();
  const { address } = params;

  let invoices: Invoice[] = [];
  try {
    // as any: getInvoicesByCreator is not yet declared in the published @stellar-split/sdk types
    invoices = await (splitClient as any).getInvoicesByCreator(address);
  } catch {
    // SDK doesn't expose this method yet; show empty state
  }

  const released = invoices.filter((inv) => inv.status === "Released");
  const totalVolume = released.reduce(
    (sum, inv) => sum + inv.recipients.reduce((s, r) => s + r.amount, 0n),
    0n
  );
  const successRate =
    invoices.length === 0
      ? 0
      : Math.round((released.length / invoices.length) * 100);

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <ProfileClient
        address={address}
        totalInvoices={invoices.length}
        totalVolume={formatAmount(totalVolume)}
        successRate={successRate}
        releasedInvoices={released.map((inv) => ({
          id: inv.id,
          total: formatAmount(
            inv.recipients.reduce((s, r) => s + r.amount, 0n)
          ),
        }))}
      />
    </main>
  );
}
