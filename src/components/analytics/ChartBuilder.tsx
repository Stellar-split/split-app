"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";

// Recharts imports are done via dynamic to match the existing analytics pattern
const DynamicLineChart = dynamic(
  () =>
    import("recharts").then((m) => {
      const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
      return function Chart({ data, xKey, yKey }: { data: Record<string, unknown>[]; xKey: string; yKey: string }) {
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f3f4f6" }}
              />
              <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

const DynamicBarChart = dynamic(
  () =>
    import("recharts").then((m) => {
      const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
      return function Chart({ data, xKey, yKey }: { data: Record<string, unknown>[]; xKey: string; yKey: string }) {
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f3f4f6" }}
              />
              <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

const DynamicAreaChart = dynamic(
  () =>
    import("recharts").then((m) => {
      const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
      return function Chart({ data, xKey, yKey }: { data: Record<string, unknown>[]; xKey: string; yKey: string }) {
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey={xKey} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f3f4f6" }}
              />
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey={yKey}
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#chartGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

export type ChartType = "bar" | "line" | "area";
export type MetricKey = "amount" | "count" | "successRate" | "avgFundingHours";
export type GroupByKey = "week" | "status" | "payer";

export interface ChartBuilderDataPoint {
  label: string;
  amount: number;
  count: number;
  successRate: number;
  avgFundingHours: number;
}

interface Props {
  data: ChartBuilderDataPoint[];
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
];

const METRICS: { value: MetricKey; label: string }[] = [
  { value: "amount", label: "USDC Raised" },
  { value: "count", label: "Invoice Count" },
  { value: "successRate", label: "Success Rate (%)" },
  { value: "avgFundingHours", label: "Avg Funding Time (h)" },
];

const ChartFallback = () => (
  <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
    Loading chart…
  </div>
);

export default function ChartBuilder({ data }: Props) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [metric, setMetric] = useState<MetricKey>("amount");

  const chartData = useMemo(
    () => data.map((d) => ({ label: d.label, [metric]: d[metric] })),
    [data, metric]
  );

  const hasData = data.length > 0;

  const chartProps = { data: chartData as Record<string, unknown>[], xKey: "label", yKey: metric };

  return (
    <section
      aria-labelledby="chart-builder-heading"
      className="bg-gray-900 rounded-xl border border-gray-800 p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 id="chart-builder-heading" className="text-base font-semibold text-white">
          Custom Chart Builder
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Metric selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="chart-metric" className="text-xs text-gray-400 shrink-0">
              Metric
            </label>
            <select
              id="chart-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart type toggle */}
          <div
            role="group"
            aria-label="Chart type"
            className="flex rounded-lg overflow-hidden border border-gray-700"
          >
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setChartType(ct.value)}
                aria-pressed={chartType === ct.value}
                className={`px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                  chartType === ct.value
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
          No data to display. Adjust the date range filter.
        </div>
      ) : (
        <>
          {chartType === "bar" && <DynamicBarChart {...chartProps} />}
          {chartType === "line" && <DynamicLineChart {...chartProps} />}
          {chartType === "area" && <DynamicAreaChart {...chartProps} />}
        </>
      )}

      <p className="text-xs text-gray-600 mt-3">
        Showing {data.length} data point{data.length !== 1 ? "s" : ""} · Metric: {METRICS.find((m) => m.value === metric)?.label}
      </p>
    </section>
  );
}
