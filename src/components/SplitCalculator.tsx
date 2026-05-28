"use client";

import { useState } from "react";
import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
}

export default function SplitCalculator({ invoice }: Props) {
  const [totalAmount, setTotalAmount] = useState("");

  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);
  const totalNum = Number(total) / 1e7;

  const amount = totalAmount ? parseFloat(totalAmount) : 0;
  const splits = invoice.recipients.map((r) => {
    const percentage = totalNum > 0 ? (Number(r.amount) / 1e7 / totalNum) * 100 : 0;
    const share = (amount * percentage) / 100;
    return { recipient: r.address, percentage, share };
  });

  const maxPercentage = Math.max(...splits.map((s) => s.percentage), 0);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Split Calculator</h2>
      <div className="mb-4">
        <label htmlFor="calc-total" className="block text-sm font-medium text-gray-300 mb-1">
          Total Amount (USDC)
        </label>
        <input
          id="calc-total"
          type="number"
          step="0.0000001"
          min="0"
          placeholder="Enter amount"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {amount > 0 && (
        <>
          {/* Stacked bar chart */}
          <div className="mb-4 bg-gray-900 rounded-lg p-3">
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 bg-gray-800">
              {splits.map((s, i) => (
                <div
                  key={i}
                  className="bg-indigo-600 transition-all"
                  style={{
                    width: `${(s.percentage / maxPercentage) * 100}%`,
                  }}
                  title={`${s.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
          </div>

          {/* Breakdown */}
          <ul className="flex flex-col gap-2">
            {splits.map((s, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 bg-gray-900 rounded-lg px-4 py-2 text-sm"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-gray-400 text-xs">{s.percentage.toFixed(1)}%</span>
                  <span className="font-mono text-gray-300 truncate text-xs">{s.recipient}</span>
                </div>
                <span className="text-indigo-300 font-semibold shrink-0">
                  {formatAmount(BigInt(Math.round(s.share * 1e7)))} USDC
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
