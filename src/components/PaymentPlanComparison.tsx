'use client';

import React, { useState } from 'react';
import type { PaymentPlan } from '@/lib/planCalculator';
import { getFinancingFeeAmount, formatPlanForDisplay } from '@/lib/planCalculator';
import { formatAmount } from '@stellar-split/sdk';

interface PaymentPlanComparisonProps {
  plans: PaymentPlan[];
  onSelectPlan: (plan: PaymentPlan) => void;
  selectedPlanIndex?: number;
}

export default function PaymentPlanComparison({
  plans,
  onSelectPlan,
  selectedPlanIndex,
}: PaymentPlanComparisonProps) {
  const [hoveredPlanIndex, setHoveredPlanIndex] = useState<number | null>(null);

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-max md:min-w-full">
        {plans.map((plan, index) => {
          const isSelected = selectedPlanIndex === index;
          const isHovered = hoveredPlanIndex === index;
          const formatted = formatPlanForDisplay(plan);
          const financingFee = getFinancingFeeAmount(plan);

          return (
            <div
              key={index}
              onMouseEnter={() => setHoveredPlanIndex(index)}
              onMouseLeave={() => setHoveredPlanIndex(null)}
              onClick={() => onSelectPlan(plan)}
              className={`
                relative rounded-lg border-2 transition-all cursor-pointer
                ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-indigo-300'
                }
                ${isHovered && !isSelected ? 'shadow-md' : ''}
                p-6 min-h-[400px] flex flex-col
              `}
            >
              {/* Header */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">{formatted.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{formatted.description}</p>
              </div>

              {/* Financing Info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Financing Fee:</span>
                  <span className="font-semibold text-blue-900">
                    {formatAmount(financingFee)} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-700">Rate:</span>
                  <span className="font-semibold text-blue-900">{formatted.financing}</span>
                </div>
              </div>

              {/* Milestones Table */}
              <div className="flex-grow mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment Schedule</h4>
                <div className="overflow-y-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left font-semibold text-gray-600 py-2">Due Date</th>
                        <th className="text-right font-semibold text-gray-600 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.milestones.map((milestone, mIndex) => (
                        <tr key={mIndex} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 text-gray-700">
                            {formatted.dueDates[mIndex]}
                          </td>
                          <td className="py-3 text-right text-gray-700 font-medium">
                            {formatted.amounts[mIndex]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Cost */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Total Cost:</span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatted.total} USDC
                  </span>
                </div>
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
