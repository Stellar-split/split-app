import { unstable_noStore as noStore } from "next/cache";
import { splitClient } from "@/lib/stellar";
import { formatAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";

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
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Invoice Verification</h1>
        <p className="text-red-600 dark:text-red-400">{fetchError}</p>
      </main>
    );
  }

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  const statusColor: Record<string, string> = {
    Pending: "text-yellow-600 dark:text-yellow-400",
    Released: "text-green-600 dark:text-green-400",
    Refunded: "text-gray-600 dark:text-gray-400",
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">
          ✓ Verified on-chain
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">Invoice #{id}</h1>
      <p className={`text-lg font-semibold mb-6 ${statusColor[invoice.status]}`}>
        {invoice.status}
      </p>

      <PaymentProgress funded={invoice.funded} total={total} />
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">
        {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
      </p>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2 text-gray-700 dark:text-gray-300">Creator</h2>
        <p className="font-mono text-sm text-gray-600 dark:text-gray-400 break-all">{invoice.creator}</p>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2 text-gray-700 dark:text-gray-300">Recipients</h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2 text-sm border border-gray-200 dark:border-gray-800"
            >
              <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                {r.address}
              </span>
              <span className="text-indigo-600 dark:text-indigo-300">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Payments ({invoice.payments.length})
        </h2>
        {invoice.payments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-500 text-sm">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoice.payments.map((p, i) => (
              <li
                key={i}
                className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2 text-sm border border-gray-200 dark:border-gray-800"
              >
                <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                  {p.payer}
                </span>
                <span className="text-indigo-600 dark:text-indigo-300">{formatAmount(p.amount)} USDC</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}