"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatAmount } from "@stellar-split/sdk";
import type { Payment } from "@stellar-split/sdk";

interface Props {
  payments: Payment[];
  total: bigint;
  createdAt: number; // unix seconds — invoice creation timestamp
}

interface DataPoint {
  /** Seconds elapsed since invoice creation */
  elapsed: number;
  /** Human-readable x-axis label */
  label: string;
  /** Cumulative funded amount as a plain number (USDC units, 7 decimals) */
  cumulative: number;
  /** Raw bigint for tooltip formatting */
  cumulativeRaw: bigint;
}

/** Format elapsed seconds into a readable relative label */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/** Convert a bigint USDC amount (7 decimal places) to a plain JS number */
function toNumber(amount: bigint): number {
  return Number(amount) / 1e7;
}

function buildSeries(payments: Payment[], createdAt: number): DataPoint[] {
  const sorted = [...payments]
    .filter((p) => !("pending" in p && (p as { pending?: boolean }).pending))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0) return [];

  // Always start from the origin (invoice creation)
  const points: DataPoint[] = [
    { elapsed: 0, label: "0s", cumulative: 0, cumulativeRaw: 0n },
  ];

  let running = 0n;
  for (const p of sorted) {
    running += p.amount;
    const elapsed = Math.max(0, p.timestamp - createdAt);
    points.push({
      elapsed,
      label: formatElapsed(elapsed),
      cumulative: toNumber(running),
      cumulativeRaw: running,
    });
  }

  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DataPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{point.label} after creation</p>
      <p className="text-indigo-300 font-semibold">
        {formatAmount(point.cumulativeRaw)} USDC
      </p>
    </div>
  );
}

export default function VelocityChart({ payments, total, createdAt }: Props) {
  const series = buildSeries(payments, createdAt);
  const totalNum = toNumber(total);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-500">
        No payments yet — chart will appear once funding begins.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatAmount(BigInt(Math.round(v * 1e7)))}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        {totalNum > 0 && (
          <ReferenceLine
            y={totalNum}
            stroke="#4ade80"
            strokeDasharray="4 3"
            label={{
              value: `Total: ${formatAmount(total)} USDC`,
              position: "insideTopRight",
              fill: "#4ade80",
              fontSize: 11,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#velocityGradient)"
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#818cf8" }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
