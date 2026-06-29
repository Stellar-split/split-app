import { truncateAddress, formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import FundingProgress from "./FundingProgress";
import StatusBadge from "./StatusBadge";
import DeadlineCountdown from "./DeadlineCountdown";

interface Props {
  invoice: Invoice;
  displayNumber?: string;
  onShareQR?: () => void;
}

/**
 * InvoiceCard — summary card showing recipients, total, funded %, and status.
 */
export default function InvoiceCard({ invoice, displayNumber, onShareQR }: Props) {
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const deadlineLabel = new Date(invoice.deadline * 1000).toLocaleDateString();

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 sm:p-5 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Invoice #{invoice.id}
          {displayNumber && (
            <span className="ml-2 text-xs font-mono text-indigo-600 dark:text-indigo-400">
              ({displayNumber})
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 relative z-20 pointer-events-auto">
          {onShareQR && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShareQR();
              }}
              className="p-1 rounded-md bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors border border-gray-300 dark:border-gray-700"
              aria-label={`Share Invoice #${invoice.id} via QR code`}
              title="Share via QR Code"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM17 5h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V6a1 1 0 011-1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </button>
          )}
          <StatusBadge status={invoice.status as any} size="sm" />
        </div>
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
