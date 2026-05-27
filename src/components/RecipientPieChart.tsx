"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Recipient } from "@stellar-split/sdk";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c"];

interface Props {
  recipients: Recipient[];
  total: bigint;
}

export default function RecipientPieChart({ recipients, total }: Props) {
  const data = recipients.map((r) => ({
    address: r.address,
    name: truncateAddress(r.address),
    amount: r.amount,
    value: Number((r.amount * 10000n) / total) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie dataKey="value" data={data} cx="50%" cy="45%" outerRadius="60%" isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, _: string, props: { payload?: { address: string; amount: bigint } }) => [
            `${formatAmount(props.payload?.amount ?? 0n)} USDC (${value.toFixed(2)}%)`,
            props.payload?.address ?? "",
          ]}
          contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px", fontSize: "12px" }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ display: "none" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          formatter={(value: string, entry: { payload?: Record<string, unknown> }) => {
            const amount = (entry.payload?.amount as bigint | undefined) ?? 0n;
            return `${value} — ${formatAmount(amount)} USDC`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
