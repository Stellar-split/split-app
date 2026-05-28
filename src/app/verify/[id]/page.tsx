import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import VerifyPayButton from "./VerifyPayButton";
import CopyLinkButton from "@/components/CopyLinkButton";
import ReputationBadge from "@/components/ReputationBadge";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

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

/**
 * Public verification page — verifies an invoice on-chain via Stellar RPC.
 * No wallet connection required.
 */
export default async function VerifyPage({ params }: Props) {
  noStore();
  const { id } = params;

  let invoice;
  let fetchError: string | null = null;

  try {
    invoice = await splitClient.getInvoice(id);
  } catch {
    fetchError = `Invoice #${id} not found on-chain.`;
  }

  if (fetchError || !invoice) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <h1 className="text-2xl font-bold mb-4">Invoice Verification</h1>
        <p className="text-red-400" role="alert">{fetchError}</p>
      </main>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const fundedPct =
    total === 0n ? 0 : Number((invoice.funded * 100n) / total);
  const fundedBadge = Math.min(100, Math.max(0, fundedPct));

  const statusColor: Record<string, string> = {
    Pending: "text-yellow-400",
    Released: "text-green-400",
    Refunded: "text-gray-400",
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-semibold">
          ✓ Verified on-chain
        </span>
        <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
          {fundedBadge}% funded
        </span>
        <CopyLinkButton url={`${appUrl}/verify/${id}`} />
      </div>

      <h1 className="text-3xl font-bold mb-1">Invoice #{id}</h1>
      <p
        className={`text-lg font-semibold mb-6 ${statusColor[invoice.status]}`}
        aria-label={`Status: ${invoice.status}`}
      >
        {invoice.status}
      </p>

      <section aria-labelledby="verify-progress-heading">
        <h2 id="verify-progress-heading" className="sr-only">Payment Progress</h2>
        <PaymentProgress funded={invoice.funded} total={total} />
        <p className="text-sm text-gray-400 mt-1 mb-8">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
        </p>
      </section>

      <section aria-labelledby="verify-creator-heading" className="mb-6">
        <h2 id="verify-creator-heading" className="text-base font-semibold mb-2 text-gray-300">Creator</h2>
        <p className="font-mono text-sm text-gray-400" title={invoice.creator}>
          <span className="sm:hidden">{truncateAddress(invoice.creator)}</span>
          <span className="hidden sm:inline break-all">{invoice.creator}</span>
        </p>
      </section>

      <section aria-labelledby="verify-recipients-heading" className="mb-6">
        <h2 id="verify-recipients-heading" className="text-base font-semibold mb-2 text-gray-300">Recipients</h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm min-w-0 items-center"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono text-gray-300 min-w-0 shrink" title={r.address}>
                  <span className="sm:hidden">{truncateAddress(r.address)}</span>
                  <span className="hidden sm:inline truncate">{r.address}</span>
                </span>
                <ReputationBadge address={r.address} />
              </div>
              <span className="text-indigo-300 shrink-0">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="verify-payments-heading">
        <h2 id="verify-payments-heading" className="text-base font-semibold mb-2 text-gray-300">
          Payments ({invoice.payments.length})
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-gray-500 text-sm">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoice.payments.map((p, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm min-w-0"
              >
                <span className="font-mono text-gray-300 min-w-0 shrink" title={p.payer}>
                  <span className="sm:hidden">{truncateAddress(p.payer)}</span>
                  <span className="hidden sm:inline truncate">{p.payer}</span>
                </span>
                <span className="text-indigo-300 shrink-0">{formatAmount(p.amount)} USDC</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VerifyPayButton invoiceId={id} status={invoice.status} />
    </main>
  );
}
