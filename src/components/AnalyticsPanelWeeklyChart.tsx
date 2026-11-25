"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface WeeklyChartDatum {
  week: string;
  invoices: number;
}

/**
 * Split out of AnalyticsPanel so `recharts` is only fetched once the panel
 * is actually expanded, via `next/dynamic`, instead of loading with every
 * page that renders the (initially collapsed) panel.
 */
export default function AnalyticsPanelWeeklyChart({ data }: { data: WeeklyChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="invoices" fill="#6366f1" />
      </BarChart>
    </ResponsiveContainer>
  );
}
