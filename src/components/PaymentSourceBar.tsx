"use client";

import { useState } from "react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Payment } from "@stellar-split/sdk";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c"];

interface Props {
  payments: Payment[];
  total: bigint;
}

interface PayerSegment {
  payer: string;
  amount: bigint;
  percentage: number;
  color: string;
}

export default function PaymentSourceBar({ payments, total }: Props) {
  const [hoveredPayer, setHoveredPayer] = useState<string | null>(null);

  // Aggregate payments by payer
  const payerMap = new Map<string, bigint>();
  payments.forEach((p) => {
    const current = payerMap.get(p.payer) || 0n;
    payerMap.set(p.payer, current + p.amount);
  });

  const segments: PayerSegment[] = Array.from(payerMap.entries())
    .map(([payer, amount], index) => ({
      payer,
      amount,
      percentage: Number((amount * 10000n) / total) / 100,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => Number(b.amount - a.amount));

  const funded = segments.reduce((sum, s) => sum + s.amount, 0n);
  const unfunded = total > funded ? total - funded : 0n;
  const unfundedPercentage = total > 0n ? Number((unfunded * 10000n) / total) / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Stacked Bar */}
      <div className="flex h-8 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
        {segments.map((segment) => (
          <div
            key={segment.payer}
            style={{
              width: `${segment.percentage}%`,
              backgroundColor: segment.color,
            }}
            className="relative group cursor-pointer transition-opacity hover:opacity-80"
            onMouseEnter={() => setHoveredPayer(segment.payer)}
            onMouseLeave={() => setHoveredPayer(null)}
            title={`${segment.payer}: ${formatAmount(segment.amount)} USDC`}
          >
            {segment.percentage > 8 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white pointer-events-none">
                {segment.percentage.toFixed(0)}%
              </span>
            )}
            {hoveredPayer === segment.payer && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 border border-gray-600">
                {truncateAddress(segment.payer)}: {formatAmount(segment.amount)} USDC
              </div>
            )}
          </div>
        ))}
        {unfunded > 0n && (
          <div
            style={{ width: `${unfundedPercentage}%` }}
            className="bg-gray-700"
            title={`Unfunded: ${formatAmount(unfunded)} USDC`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((segment) => (
          <div
            key={segment.payer}
            className="flex items-center justify-between text-sm"
            onMouseEnter={() => setHoveredPayer(segment.payer)}
            onMouseLeave={() => setHoveredPayer(null)}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: segment.color }}
              />
              <span className="font-mono text-gray-300 truncate max-w-xs">
                {truncateAddress(segment.payer)}
              </span>
            </div>
            <span className="text-indigo-300 font-semibold">
              {formatAmount(segment.amount)} USDC
            </span>
          </div>
        ))}
        {unfunded > 0n && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-700" />
              <span className="text-gray-400">Unfunded</span>
            </div>
            <span className="text-gray-400 font-semibold">
              {formatAmount(unfunded)} USDC
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
