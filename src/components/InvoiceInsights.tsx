"use client";

import { useMemo, useState } from "react";
import {
  computeInvoiceInsightsWithTrends,
  type InsightsInvoice,
  type InsightsRange,
  type TrendIndicator,
} from "@/lib/invoiceInsights";

const RANGE_OPTIONS: { key: InsightsRange; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

const TREND_STYLES: Record<TrendIndicator["direction"], string> = {
  up: "text-green-400",
  down: "text-red-400",
  flat: "text-gray-400",
};

const TREND_GLYPHS: Record<TrendIndicator["direction"], string> = {
  up: "▲",
  down: "▼",
  flat: "■",
};

function formatUsdc(value: number): string {
  return `$${value.toFixed(2)}`;
}

function TrendBadge({ trend, label }: { trend: TrendIndicator; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${TREND_STYLES[trend.direction]}`}
      aria-label={`${label} trend ${trend.direction} ${trend.changePercent}%`}
    >
      <span aria-hidden="true">{TREND_GLYPHS[trend.direction]}</span>
      {trend.changePercent.toFixed(1)}%
    </span>
  );
}

interface Props {
  invoices: InsightsInvoice[];
  /** Injectable clock (unix seconds) for deterministic rendering. */
  now?: number;
}

/**
 * InvoiceInsights renders invoice analytics metrics with time-range filtering
 * and period-over-period trend indicators.
 */
export default function InvoiceInsights({ invoices, now }: Props) {
  const [range, setRange] = useState<InsightsRange>("30d");

  const { metrics, trends } = useMemo(
    () => computeInvoiceInsightsWithTrends(invoices, range, now),
    [invoices, range, now]
  );

  const cards: { key: keyof typeof metrics; label: string; value: string }[] = [
    { key: "totalCollected", label: "Total Collected", value: formatUsdc(metrics.totalCollected) },
    { key: "averagePayment", label: "Average Payment", value: formatUsdc(metrics.averagePayment) },
    {
      key: "averageInvoiceValue",
      label: "Average Invoice Value",
      value: formatUsdc(metrics.averageInvoiceValue),
    },
    { key: "largestPayment", label: "Largest Payment", value: formatUsdc(metrics.largestPayment) },
    { key: "paymentCount", label: "Payments", value: String(metrics.paymentCount) },
    { key: "paidInvoices", label: "Paid Invoices", value: String(metrics.paidInvoices) },
    { key: "successRate", label: "Success Rate", value: `${metrics.successRate.toFixed(1)}%` },
    {
      key: "averagePaymentTimeHours",
      label: "Avg Payment Time",
      value: `${metrics.averagePaymentTimeHours.toFixed(1)}h`,
    },
  ];

  return (
    <section className="space-y-4" aria-label="Invoice insights">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          Invoice Insights
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          Time range
          <select
            aria-label="Time range"
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-200"
            value={range}
            onChange={(e) => setRange(e.target.value as InsightsRange)}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {metrics.totalInvoices === 0 ? (
        <p className="text-sm text-gray-500">No invoices in this time range.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <li
              key={card.key}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4"
              data-testid={`insight-${card.key}`}
            >
              <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold text-white">{card.value}</p>
              <TrendBadge trend={trends[card.key]} label={card.label} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
