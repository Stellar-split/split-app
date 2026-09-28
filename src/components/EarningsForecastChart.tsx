"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { forecastEarnings, totalForecast, type EarningsPoint } from "@/lib/earningsForecast";

interface Props {
  history: EarningsPoint[];
}

const HORIZONS = [3, 6, 12] as const;

function nextMonthLabels(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() + i + 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    })
  );
}

export default function EarningsForecastChart({ history }: Props) {
  const [horizon, setHorizon] = useState<number>(3);

  const data = useMemo(
    () =>
      forecastEarnings(history, horizon, nextMonthLabels(horizon)).map((p) => ({
        ...p,
        band: p.low !== undefined && p.high !== undefined ? [p.low, p.high] : undefined,
      })),
    [history, horizon]
  );
  const total = useMemo(() => totalForecast(data), [data]);
  const hasData = history.some((h) => h.value > 0);

  return (
    <section aria-labelledby="forecast-heading" className="bg-gray-900 rounded-xl p-5 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="forecast-heading" className="text-lg font-semibold">
          Earnings Forecast
        </h2>
        <div role="group" aria-label="Forecast horizon" className="flex gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={horizon === h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                horizon === h ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-gray-500 text-sm">Not enough earnings history to forecast yet.</p>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-3">
            Projected next {horizon} months:{" "}
            <span data-testid="forecast-total" className="font-semibold text-emerald-300">
              {total} USDC
            </span>
          </p>
          <div className="w-full h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} unit=" USDC" width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
                <Area dataKey="band" name="Range" stroke="none" fill="#10b981" fillOpacity={0.15} />
                <Line dataKey="actual" name="Actual" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line
                  dataKey="forecast"
                  name="Forecast"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Linear trend over your last {history.length} months; shaded area shows the expected range.
          </p>
        </>
      )}
    </section>
  );
}
