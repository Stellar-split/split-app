import { truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import FundingProgress from "./FundingProgress";
import StatusBadge from "./StatusBadge";
import CountdownTimer from "./CountdownTimer";

interface Props {
  invoice: Invoice;
  displayNumber?: string;
  title?: string;
}

/**
 * InvoiceCard — summary card showing recipients, total, funded %, and status.
 */
export default function InvoiceCard({ invoice, displayNumber }: Props) {
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const deadlineLabel = new Date(invoice.deadline * 1000).toLocaleDateString();

  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5 hover:bg-gray-800 transition-colors cursor-pointer min-w-0 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-300 truncate block">
            {title ?? `Invoice #${invoice.id}`}
          </span>
          {displayNumber && (
            <span className="text-xs font-mono text-indigo-400">
              {displayNumber}
            </span>
          )}
        </span>
        <StatusBadge status={invoice.status as any} size="sm" />
      </div>

      <p className="text-xs text-gray-500 mb-3">Due {deadlineLabel}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {invoice.recipients.map((r, i) => (
          <span
            key={i}
            className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 px-2 py-0.5 rounded font-mono truncate max-w-[140px]"
          >
            {truncateAddress(r.address)}
          </span>
        ))}
      </div>

      {/* Progress — compact (no label) */}
      <FundingProgress funded={invoice.funded} total={total} token={invoice.token || "USDC"} compact />

      {invoice.deadline > 0 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
          <span className="text-xs text-gray-500">Deadline</span>
          <CountdownTimer deadline={invoice.deadline} compact />
        </div>

        {invoice.deadline > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
            <span className="text-xs text-gray-500">Deadline</span>
            <CountdownTimer deadline={invoice.deadline} compact />
          </div>
        )}
      </div>
    </div>
  );
}
