import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import FundingProgress from "@/components/FundingProgress";
import StatusBadge from "@/components/StatusBadge";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import PayPreviewButton from "@/components/PayPreviewButton";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://splitapp-steel.vercel.app");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  try {
    const invoice = await splitClient.getInvoice(id);
    const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
    const pct =
      total === 0n ? 0 : Number((invoice.funded * 100n) / total);
    const title = `Invoice #${id} — ${invoice.status} | StellarSplit`;
    const description = `${pct}% funded · ${formatAmount(invoice.funded)} / ${formatAmount(total)} USDC · Created by ${truncateAddress(invoice.creator)}`;
    const url = `${appUrl}/invoice/${id}/preview`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        url,
        siteName: "StellarSplit",
        type: "website",
      },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {
      title: `Invoice #${id} | StellarSplit`,
      robots: { index: false, follow: false },
    };
  }
}

/**
 * Public invoice preview page — read-only, no wallet required.
 * Includes noindex meta tag and Open Graph tags for rich link previews.
 */
export default async function InvoicePreviewPage({ params }: Props) {
  noStore();
  const { id } = params;

  let invoice;
  let fetchError: string | null = null;

  try {
    invoice = await splitClient.getInvoice(id);
  } catch {
    fetchError = `Invoice #${id} not found.`;
  }

  if (fetchError || !invoice) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Invoice Preview</h1>
        <p className="text-red-400" role="alert">
          {fetchError}
        </p>
      </main>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold">Invoice #{id}</h1>
        <StatusBadge status={invoice.status as any} size="md" />
      </div>

      {/* Creator */}
      <section aria-labelledby="preview-creator-heading" className="mb-6">
        <h2
          id="preview-creator-heading"
          className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-1"
        >
          Creator
        </h2>
        <p className="font-mono text-sm text-gray-300 break-all" title={invoice.creator}>
          <span className="sm:hidden">{truncateAddress(invoice.creator)}</span>
          <span className="hidden sm:inline">{invoice.creator}</span>
        </p>
      </section>

      {/* Funding progress */}
      <section aria-labelledby="preview-progress-heading" className="mb-6">
        <h2 id="preview-progress-heading" className="sr-only">
          Funding Progress
        </h2>
        <FundingProgress
          funded={invoice.funded}
          total={total}
          token={invoice.token || "USDC"}
        />
      </section>

      {/* Deadline */}
      {invoice.deadline > 0 && (
        <section aria-labelledby="preview-deadline-heading" className="mb-6">
          <h2
            id="preview-deadline-heading"
            className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-1"
          >
            Deadline
          </h2>
          <DeadlineCountdown deadline={invoice.deadline} />
        </section>
      )}

      {/* Recipients */}
      <section aria-labelledby="preview-recipients-heading" className="mb-6">
        <h2
          id="preview-recipients-heading"
          className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2"
        >
          Recipients ({invoice.recipients.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm min-w-0 items-center"
            >
              <span
                className="font-mono text-gray-300 min-w-0 shrink truncate"
                title={r.address}
              >
                <span className="sm:hidden">{truncateAddress(r.address)}</span>
                <span className="hidden sm:inline">{r.address}</span>
              </span>
              <span className="text-indigo-300 shrink-0 font-medium">
                {formatAmount(r.amount)} USDC
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <PayPreviewButton invoiceId={id} status={invoice.status} />
    </main>
  );
}
