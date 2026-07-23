"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface UniquePayersChartProps {
  data: { label: string; count: number }[];
}

export default function UniquePayersChart({ data }: UniquePayersChartProps) {
  if (data.length === 0) {
    return (
      <div
        role="figure"
        aria-label="Unique payers over time chart"
        className="h-[280px] flex items-center justify-center text-gray-500 text-sm"
      >
        No data available
      </div>
    );
  }

  return (
    <div role="figure" aria-label="Unique payers over time chart">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#f3f4f6" }}
            formatter={(v: number) => [`${v}`, "Unique Payers"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#8b5cf6"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
