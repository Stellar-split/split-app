import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import PaymentProgress from "./PaymentProgress";

interface Props {
  invoice: Invoice;
}

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-300",
  Released: "bg-green-500/20 text-green-600 dark:text-green-300",
  Refunded: "bg-gray-500/20 text-gray-600 dark:text-gray-300",
};

/**
 * InvoiceCard — summary card showing recipients, total, funded %, and status.
 */
export default function InvoiceCard({ invoice }: Props) {
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Invoice #{invoice.id}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[invoice.status]}`}
        >
          {invoice.status}
        </span>
      </div>

      {/* Recipients */}
      <div className="flex flex-wrap gap-1 mb-3">
        {invoice.recipients.map((r, i) => (
          <span
            key={i}
            className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 px-2 py-0.5 rounded font-mono"
          >
            {truncateAddress(r.address)}
          </span>
        ))}
      </div>

      {/* Progress */}
      <PaymentProgress funded={invoice.funded} total={total} />

      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
        <span>{formatAmount(invoice.funded)} USDC funded</span>
        <span>Total: {formatAmount(total)} USDC</span>
      </div>
    </div>
  );
}