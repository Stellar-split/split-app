"use client";

import { formatAmount } from "@stellar-split/sdk";

interface Props {
  totalAmount: bigint;
  deadline: number;
  onSelectPlan?: (months: number) => void;
}

export default function InstallmentPlanComparator({ totalAmount, deadline, onSelectPlan }: Props) {
  const monthOptions = [3, 6, 12];
  const deadlineDate = new Date(deadline * 1000);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Installment Plans</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 px-4">Months</th>
              <th className="text-right py-2 px-4">Per Payment</th>
              <th className="text-left py-2 px-4">Payoff</th>
              <th className="text-center py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {monthOptions.map(months => {
              const perPayment = totalAmount / BigInt(months);
              const remainder = totalAmount % BigInt(months);
              const finalPayment = perPayment + remainder;
              const payoffDate = new Date(deadlineDate);
              payoffDate.setMonth(payoffDate.getMonth() + months);

              return (
                <tr key={months} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold">{months}</td>
                  <td className="py-3 px-4 text-right">{formatAmount(perPayment)} USDC</td>
                  <td className="py-3 px-4">{payoffDate.toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onSelectPlan?.(months)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-semibold"
                    >
                      Select
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
