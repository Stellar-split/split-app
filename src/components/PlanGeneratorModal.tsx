'use client';

import React, { useState } from 'react';
import type { PaymentPlan } from '@/lib/planCalculator';
import { generateSuggestedPlans } from '@/lib/planCalculator';
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
