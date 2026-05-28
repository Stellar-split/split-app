import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

/**
 * PaymentProgress — animated progress bar showing invoice funding percentage.
 */
interface Props {
  /** Live invoice — preferred when polling for real-time updates. */
  invoice?: Invoice;
  /** Amount funded so far in stroops. */
  funded?: bigint;
  /** Total invoice amount in stroops. */
  total?: bigint;
}

export default function PaymentProgress({ invoice, funded, total }: Props) {
  const fundedAmount = invoice?.funded ?? funded ?? 0n;
  const totalAmount =
    invoice?.recipients.reduce((s, r) => s + r.amount, 0n) ?? total ?? 0n;
  const pct =
    totalAmount === 0n ? 0 : Number((fundedAmount * 100n) / totalAmount);
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clamped}% funded`}
        className="w-full bg-gray-700 rounded-full h-2 overflow-hidden"
      >
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {invoice && (
        <p className="text-sm text-gray-400 mt-1">
          {formatAmount(fundedAmount)} / {formatAmount(totalAmount)} USDC funded
        </p>
      )}
    </div>
  );
}
