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

export interface RevenueMonthlyChartData {
  month: string;
  usdc: number;
}

/**
 * Split out of the revenue page so `recharts` can be lazy-loaded via
 * `next/dynamic` instead of shipping in the page's initial chunk.
 */
export default function RevenueMonthlyChart({ data }: { data: RevenueMonthlyChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} unit=" USDC" width={80} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          itemStyle={{ color: "#818cf8" }}
          formatter={(value: number) => [`${value} USDC`, "Revenue"]}
        />
        <Bar dataKey="usdc" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
