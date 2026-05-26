import { unstable_noStore as noStore } from "next/cache";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import VerifyPayButton from "./VerifyPayButton";

interface Props {
  params: { id: string };
}

// Force dynamic rendering — this page fetches live on-chain data
export const dynamic = "force-dynamic";

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
  } catch (e) {
    fetchError = `Invoice #${id} not found on-chain.`;
  }

  if (fetchError || !invoice) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Invoice Verification</h1>
        <p className="text-red-400">{fetchError}</p>
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
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-semibold">
          ✓ Verified on-chain
        </span>
        <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
          {fundedBadge}% funded
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Invoice #{id}</h1>
      <p className={`text-lg font-semibold mb-6 ${statusColor[invoice.status]}`}>
        {invoice.status}
      </p>

      <PaymentProgress funded={invoice.funded} total={total} />
      <p className="text-sm text-gray-400 mt-1 mb-8">
        {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
      </p>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-gray-300">
          Recipient breakdown
        </h2>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-2 font-medium">Address</th>
                <th className="pb-2 pr-2 font-medium text-right">Owed</th>
                <th className="pb-2 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {invoice.recipients.map((r, i) => {
                const sharePct =
                  total === 0n ? 0 : Number((r.amount * 100n) / total);
                return (
                  <tr key={i} className="border-b border-gray-900">
                    <td className="py-2 pr-2 font-mono text-gray-300">
                      {truncateAddress(r.address)}
                    </td>
                    <td className="py-2 pr-2 text-right text-indigo-300 whitespace-nowrap">
                      {formatAmount(r.amount)} USDC
                    </td>
                    <td className="py-2 text-right text-gray-400 whitespace-nowrap">
                      {sharePct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-gray-300">
          Payment history
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-gray-500 text-sm">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoice.payments.map((p, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm"
              >
                <span className="font-mono text-gray-300 truncate min-w-0">
                  {truncateAddress(p.payer)}
                </span>
                <span className="text-indigo-300 shrink-0">
                  {formatAmount(p.amount)} USDC
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2 text-gray-300">Creator</h2>
        <p className="font-mono text-sm text-gray-400 break-all">
          {truncateAddress(invoice.creator)}
        </p>
      </section>

      <VerifyPayButton invoiceId={id} status={invoice.status} />
    </main>
  );
}
