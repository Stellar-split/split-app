"use client";

import { useEffect, useState } from "react";
import {
  usePaymentVelocity,
  VELOCITY_WINDOWS,
  type VelocityWindow,
  type PaymentVelocityAlert,
} from "@/hooks/usePaymentVelocity";

interface Props {
  /** Connected account to track; omit to show zeroed gauges. */
  account?: string | null;
}

const WINDOW_LABELS: Record<VelocityWindow, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
};

/** Fill color by volume/threshold ratio: green < 80%, amber < 100%, red beyond. */
function fillFor(volume: number, threshold: number): { pct: number; color: string } {
  const ratio = threshold > 0 ? volume / threshold : 0;
  const pct = Math.min(ratio * 100, 100);
  const color = ratio > 1 ? "#ef4444" : ratio >= 0.8 ? "#f59e0b" : "#10b981";
  return { pct, color };
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * PaymentVelocityGauge (#408) — SVG gauges for the rolling 1h / 24h / 7d
 * outgoing payment volume of the connected account, with inline threshold
 * configuration and an alert banner when a threshold is breached.
 */
export default function PaymentVelocityGauge({ account }: Props) {
  const { velocities, lastUpdated, loading, error, thresholds, setThreshold } =
    usePaymentVelocity(account);
  const [alerts, setAlerts] = useState<PaymentVelocityAlert[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onAlert = (e: Event) => {
      const detail = (e as CustomEvent<PaymentVelocityAlert>).detail;
      if (!detail) return;
      setAlerts((prev) =>
        prev.some((a) => a.window === detail.window) ? prev : [...prev, detail],
      );
    };
    globalThis.addEventListener?.("velocity:alert", onAlert);
    return () => globalThis.removeEventListener?.("velocity:alert", onAlert);
  }, []);

  if (loading && !velocities) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4" role="status">
        <p className="text-sm text-gray-500">Loading velocity data...</p>
      </div>
    );
  }

  if (error && !velocities) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4" role="alert">
        <p className="text-sm text-red-400">Unable to load velocity data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Payment Velocity
        </h3>
        <button
          type="button"
          data-testid="threshold-popover-trigger"
          onClick={() => setSettingsOpen((v) => !v)}
          className="min-h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 text-xs font-semibold transition-colors"
          aria-expanded={settingsOpen}
        >
          ⚙️ Settings
        </button>
      </div>

      {settingsOpen && (
        <div
          data-testid="popover-content"
          className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
        >
          {VELOCITY_WINDOWS.map((window) => (
            <label key={window} className="flex flex-col gap-1 text-xs text-gray-500">
              {WINDOW_LABELS[window]} threshold
              <input
                type="number"
                min={0}
                value={thresholds[window]}
                onChange={(e) => setThreshold(window, Number(e.target.value) || 0)}
                className="min-h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div
          data-testid="alert-banner"
          role="alert"
          className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Payment Velocity Alert
            </p>
            <button
              type="button"
              data-testid="dismiss-alert"
              onClick={() => setAlerts([])}
              className="text-xs text-red-500 hover:text-red-400"
            >
              Dismiss
            </button>
          </div>
          {alerts.map((alert) => (
            <p key={alert.window} className="text-xs text-red-600 dark:text-red-300">
              {alert.window} window: ${formatMoney(alert.volume)} exceeded threshold of $
              {formatMoney(alert.threshold)}
            </p>
          ))}
        </div>
      )}

      <svg data-testid="velocity-gauges" viewBox="0 0 360 120" className="w-full max-w-md" role="img">
        <title>Payment Velocity Gauge</title>
        {VELOCITY_WINDOWS.map((window, i) => {
          const cx = 60 + i * 120;
          const r = 40;
          const circumference = Math.PI * r; // half circle
          const stat = velocities?.[window] ?? { volume: 0, threshold: 1 };
          const { pct, color } = fillFor(stat.volume, stat.threshold);
          return (
            <g key={window}>
              <path
                d={`M ${cx - r} 80 A ${r} ${r} 0 0 1 ${cx + r} 80`}
                stroke="#374151"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
              />
              <path
                data-testid={`gauge-${window}`}
                d={`M ${cx - r} 80 A ${r} ${r} 0 0 1 ${cx + r} 80`}
                stroke={color}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
              />
              <text x={cx} y={75} textAnchor="middle" className="fill-current text-sm font-bold">
                {pct.toFixed(0)}%
              </text>
              <text x={cx} y={95} textAnchor="middle" className="fill-current text-[10px]">
                {WINDOW_LABELS[window]}: ${formatMoney(stat.volume)} / ${formatMoney(stat.threshold)}
              </text>
            </g>
          );
        })}
      </svg>

      {lastUpdated && (
        <p data-testid="last-updated" className="mt-2 text-xs text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
