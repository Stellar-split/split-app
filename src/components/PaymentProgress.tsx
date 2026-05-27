/**
 * PaymentProgress — animated progress bar showing invoice funding percentage.
 */
interface Props {
  /** Amount funded so far in stroops. */
  funded: bigint;
  /** Total invoice amount in stroops. */
  total: bigint;
}

export default function PaymentProgress({ funded, total }: Props) {
  const pct = total === 0n ? 0 : Number((funded * 100n) / total);
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% funded`}
      className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
    >
      <div
        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
