'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface TrendChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

export default function TrendChart({ data, color = '#6366f1', height = 240 }: TrendChartProps) {
  if (!data.length) {
    return (
      <div
        role="figure"
        aria-label="Trend chart"
        className="flex items-center justify-center text-gray-500 text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div role="figure" aria-label="Trend chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#f3f4f6' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
