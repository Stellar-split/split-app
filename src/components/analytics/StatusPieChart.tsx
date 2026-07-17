"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface StatusPieChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b"];

export default function StatusPieChart({ data }: StatusPieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div
        role="figure"
        aria-label="Invoice status breakdown chart"
        className="h-[280px] flex items-center justify-center text-gray-500 text-sm"
      >
        No data available
      </div>
    );
  }

  return (
    <div role="figure" aria-label="Invoice status breakdown chart">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#f3f4f6" }}
          />
          <Legend
            wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
