"use client";

import { useTransactionConfirmations, FINALITY_THRESHOLD } from "@/hooks/useTransactionConfirmations";

interface Props {
  txHash: string;
}

const RADIUS = 22;
const STROKE = 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * ConfirmationCounter — shows a circular SVG progress arc that fills as
 * Stellar ledger confirmations increase toward FINALITY_THRESHOLD.
 * Polling stops when the threshold is reached.
 */
export default function ConfirmationCounter({ txHash }: Props) {
  const { confirmations, confirmed, loading, error } = useTransactionConfirmations(txHash);

  const progress = Math.min(confirmations / FINALITY_THRESHOLD, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  if (loading && confirmations === 0) {
    return (
      <div
        aria-live="polite"
        aria-label="Waiting for confirmation data"
        className="flex items-center gap-2 text-sm text-slate-400"
      >
        <span className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-brand-400 animate-spin" aria-hidden="true" />
        <span>Fetching confirmations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="text-xs text-red-400">
        Confirmation check failed: {error}
      </div>
    );
  }

  if (confirmed) {
    return (
      <div
        role="status"
        aria-label="Transaction confirmed"
        className="flex items-center gap-2 text-sm font-medium text-green-400"
      >
        {/* Green checkmark circle */}
        <svg
          width={56}
          height={56}
          viewBox={`0 0 ${(RADIUS + STROKE) * 2} ${(RADIUS + STROKE) * 2}`}
          aria-hidden="true"
        >
          <circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke="#16a34a"
            strokeWidth={STROKE}
          />
          <path
            d={`M${RADIUS - 8 + STROKE} ${RADIUS + STROKE} l6 6 10-10`}
            fill="none"
            stroke="#16a34a"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Confirmed</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={`${confirmations} of ${FINALITY_THRESHOLD} confirmations`}
      aria-live="polite"
      className="flex items-center gap-3"
    >
      {/* Circular SVG progress arc */}
      <svg
        width={56}
        height={56}
        viewBox={`0 0 ${(RADIUS + STROKE) * 2} ${(RADIUS + STROKE) * 2}`}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={RADIUS + STROKE}
          cy={RADIUS + STROKE}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-slate-700"
        />
        {/* Progress arc */}
        <circle
          cx={RADIUS + STROKE}
          cy={RADIUS + STROKE}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RADIUS + STROKE} ${RADIUS + STROKE})`}
          className="text-brand-400 transition-[stroke-dashoffset] duration-500"
          style={{ strokeDashoffset: dashOffset }}
        />
        {/* Counter text */}
        <text
          x={RADIUS + STROKE}
          y={RADIUS + STROKE + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-200"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {confirmations}/{FINALITY_THRESHOLD}
        </text>
      </svg>

      <span className="text-sm text-slate-300">
        {confirmations} / {FINALITY_THRESHOLD} confirmations
      </span>
    </div>
  );
}
