"use client";

/**
 * SplitSumIndicator — running total of recipient share percentages.
 *
 * The bar is green only when the shares sum to exactly 100% (within the
 * 0.0001 tolerance the split schema uses); it is red both when the split is
 * under-allocated and when it is over-allocated.
 */
interface SplitSumIndicatorProps {
  /** Sum of every recipient's sharePercent. */
  sum: number;
  /** True when the sum is exactly 100% within tolerance. */
  isValid: boolean;
}

const TOLERANCE = 0.0001;

export function formatSharePercent(value: number): string {
  // Keep whole numbers clean ("100%") but never hide a fractional remainder.
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(4).replace(/0+$/, "");
}

export default function SplitSumIndicator({ sum, isValid }: SplitSumIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, sum));
  const isOver = sum - 100 > TOLERANCE;
  const label = formatSharePercent(sum);

  const message = isValid
    ? "Shares total exactly 100%"
    : isOver
    ? `Over-allocated by ${formatSharePercent(sum - 100)}%`
    : `${formatSharePercent(100 - sum)}% left to allocate`;

  return (
    <div className="mb-5" data-testid="split-sum-indicator">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Allocated
        </span>
        <span
          className={`font-mono text-sm font-semibold ${
            isValid ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {label}% / 100%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(sum * 100) / 100}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${label}% of 100% allocated`}
        aria-label="Total allocated share percentage"
        className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800"
      >
        <div
          data-testid="split-sum-bar"
          data-state={isValid ? "valid" : isOver ? "over" : "under"}
          className={`h-full rounded-full transition-all duration-200 ${
            isValid ? "bg-emerald-500" : "bg-red-500"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <p
        className={`mt-1.5 text-xs ${isValid ? "text-emerald-400" : "text-red-400"}`}
        role={isValid ? undefined : "status"}
      >
        {message}
      </p>
    </div>
  );
}
