"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface WeeklyRaisedChartProps {
  data: { label: string; amount: number }[];
}

export default function WeeklyRaisedChart({ data }: WeeklyRaisedChartProps) {
  if (data.length === 0) {
    return (
      <div
        role="figure"
        aria-label="USDC raised per week chart"
        className="h-[280px] flex items-center justify-center text-gray-500 text-sm"
      >
        No data available
      </div>
    );
  }

  return (
    <div role="figure" aria-label="USDC raised per week chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
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
            formatter={(v: number) => [`$${v.toFixed(2)}`, "USDC"]}
          />
          <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
