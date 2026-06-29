import { truncateAddress, formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import FundingProgress from "./FundingProgress";
import StatusBadge from "./StatusBadge";
import DeadlineCountdown from "./DeadlineCountdown";

interface Props {
  invoice: Invoice;
  displayNumber?: string;
  onCompareToggle?: (id: string, checked: boolean) => void;
  isComparing?: boolean;
  isChecked?: boolean;
}

/**
 * InvoiceCard — summary card showing recipients, total, funded %, and status.
 * Optionally includes a compare checkbox when in compare mode.
 */
export default function InvoiceCard({ invoice, displayNumber, onCompareToggle, isComparing, isChecked }: Props) {
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const deadlineLabel = new Date(invoice.deadline * 1000).toLocaleDateString();

  return (
    <div className={`bg-gray-100 dark:bg-gray-900 rounded-xl p-4 sm:p-5 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors min-w-0 ${isComparing ? "relative" : "cursor-pointer"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isComparing && (
            <input
              type="checkbox"
              checked={isChecked || false}
              onChange={(e) => onCompareToggle?.(invoice.id, e.target.checked)}
              className="w-5 h-5 cursor-pointer rounded border-gray-400 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 shrink-0"
              aria-label={`Compare invoice ${invoice.id}`}
            />
          )}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
            Invoice #{invoice.id}
            {displayNumber && (
              <span className="ml-2 text-xs font-mono text-indigo-600 dark:text-indigo-400">
                ({displayNumber})
              </span>
            )}
          </span>
        </div>
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

      <FundingProgress
        funded={invoice.funded}
        total={total}
        token={invoice.token || "USDC"}
        compact
      />

      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatAmount(invoice.funded)} USDC funded</span>
        <span>Total: {formatAmount(total)} USDC</span>
      </div>

      {invoice.deadline > 0 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-500">Deadline</span>
          <DeadlineCountdown deadline={invoice.deadline} compact />
        </div>
      )}
    </div>
  );
}
