import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
  publicKey: string | null;
  onSuggest: (amount: string) => void;
}

export default function PaymentSuggestions({
  invoice,
  total,
  publicKey,
  onSuggest,
}: Props) {
  const remaining = total - invoice.funded;
  const half = remaining / 2n;

  const userShare = publicKey
    ? invoice.recipients.find((r) => r.address === publicKey)?.amount
    : null;

  const suggestions = [
    {
      label: "Pay remaining",
      amount: remaining,
      show: remaining > 0n,
    },
    {
      label: "Pay 50%",
      amount: half,
      show: half > 0n,
    },
    {
      label: "Pay my share",
      amount: userShare ?? 0n,
      show: userShare && userShare > 0n,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {suggestions.map(
        (s) =>
          s.show && (
            <button
              key={s.label}
              type="button"
              onClick={() => onSuggest(formatAmount(s.amount))}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-indigo-300 transition-colors"
            >
              {s.label}: {formatAmount(s.amount)} USDC
            </button>
          )
      )}
    </div>
  );
}
