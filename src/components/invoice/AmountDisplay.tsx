"use client";

import { formatAmount } from "@stellar-split/sdk";
import { useFiatRate } from "@/hooks/useFiatRate";

interface Props {
  /** Amount in stroops, or a pre-formatted decimal string. */
  amount: bigint | string;
  /** Asset ticker shown beside the primary amount. */
  symbol?: string;
  /** Extra classes for the primary amount line. */
  className?: string;
  /** Renders the pair inline instead of stacked (for tight table cells). */
  inline?: boolean;
}

/**
 * Renders an on-chain amount with its fiat equivalent underneath.
 *
 * While the rate loads a skeleton placeholder holds the space; if the rate
 * cannot be fetched the secondary line reads "Rate unavailable" rather than
 * showing a stale or invented number.
 */
export default function AmountDisplay({
  amount,
  symbol = "USDC",
  className = "",
  inline = false,
}: Props) {
  const { rate, loading, error, currency } = useFiatRate();

  const decimal = typeof amount === "bigint" ? formatAmount(amount) : amount;
  const numeric = parseFloat(decimal);

  return (
    <span className={inline ? "inline-flex items-baseline gap-2" : "inline-flex flex-col"}>
      <span className={className}>
        {decimal} {symbol}
      </span>
      <FiatLine
        numeric={numeric}
        rate={rate}
        loading={loading}
        error={error}
        currency={currency}
      />
    </span>
  );
}

function FiatLine({
  numeric,
  rate,
  loading,
  error,
  currency,
}: {
  numeric: number;
  rate: number | null;
  loading: boolean;
  error: string | null;
  currency: string;
}) {
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-block h-3 w-16 animate-pulse rounded bg-gray-700"
      />
    );
  }

  if (error || rate === null || !Number.isFinite(numeric)) {
    return <span className="text-xs text-gray-500">Rate unavailable</span>;
  }

  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(numeric * rate);

  return (
    <span className="text-xs text-gray-400" title={`Converted at 1 USDC = ${rate} ${currency}`}>
      ≈ {formatted}
    </span>
  );
}
