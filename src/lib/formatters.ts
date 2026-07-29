import { formatAmount } from "@stellar-split/sdk";

export function formatXLM(amount: bigint): string {
  return Number(formatAmount(amount)).toFixed(7);
}

export function stroopsToXLM(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}
