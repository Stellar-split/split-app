'use client';

import React, { useState } from 'react';
import type { PaymentPlan } from '@/lib/planCalculator';
import { generateSuggestedPlans, formatPlanForDisplay } from '@/lib/planCalculator';
import PaymentPlanComparison from './PaymentPlanComparison';

interface PlanGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: bigint;
  deadline: number;
  onApplyPlan: (plan: PaymentPlan) => void;
}

export default function PlanGeneratorModal({
  isOpen,
  onClose,
  totalAmount,
  deadline,
  onApplyPlan,
}: PlanGeneratorModalProps) {
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const plans = generateSuggestedPlans(totalAmount, deadline);
  const selectedPlan = plans[selectedPlanIndex];

  const handleApplyPlan = async () => {
    setIsApplying(true);
    try {
      onApplyPlan(selectedPlan);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Select Payment Plan
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose how to split your invoice payment
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <PaymentPlanComparison
            plans={plans}
            selectedPlanIndex={selectedPlanIndex}
            onSelectPlan={(plan) => {
              const index = plans.findIndex(
                (p) => p.numInstallments === plan.numInstallments
              );
              setSelectedPlanIndex(index);
            }}
          />

          {/* Live Preview Table */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Installment Schedule Preview
            </h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Due Date</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">
                      Running Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const display = formatPlanForDisplay(selectedPlan);
                    let runningTotal = 0;
                    return selectedPlan.milestones.map((milestone, i) => {
                      const amount = Number(display.amounts[i]);
                      runningTotal += amount;
                      return (
                        <tr key={milestone.dueDate}>
                          <td className="px-4 py-2 text-gray-700">{i + 1}</td>
                          <td className="px-4 py-2 text-gray-700">{display.dueDates[i]}</td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {display.amounts[i]}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {runningTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyPlan}
            disabled={isApplying}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? 'Applying...' : 'Apply Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
