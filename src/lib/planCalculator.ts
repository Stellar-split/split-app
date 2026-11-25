/**
 * Utility functions for calculating and comparing payment plans
 */

export interface InstallmentMilestone {
  dueDate: number; // Unix timestamp
  amount: bigint;
}

export interface PaymentPlan {
  numInstallments: number;
  milestones: InstallmentMilestone[];
  totalAmount: bigint;
  effectiveCost: bigint; // Total amount + financing fees
  financingFeePercentage: number;
}

/**
 * Calculate the effective cost of a payment plan including financing fees
 * @param totalAmount The total invoice amount
 * @param numInstallments Number of installments
 * @param financeRatePercentage Annual financing rate (e.g., 5 for 5%)
 * @returns Effective cost with financing fees
 */
export function calculateEffectiveCost(
  totalAmount: bigint,
  numInstallments: number,
  financeRatePercentage: number = 0
): bigint {
  if (numInstallments === 1 || financeRatePercentage === 0) {
    return totalAmount;
  }

  // Simple financing fee: proportional to number of installments
  const monthlyRate = BigInt(financeRatePercentage) / BigInt(12);
  const avgMonthsFinanced = BigInt(numInstallments - 1) / BigInt(2); // Average months outstanding
  const financingFee =
    (totalAmount * monthlyRate * avgMonthsFinanced) / BigInt(10000);

  return totalAmount + financingFee;
}

/**
 * Generate equally-spaced payment plan milestones
 * @param totalAmount Total invoice amount
 * @param numInstallments Number of installments
 * @param startDate Start date (Unix timestamp)
 * @param endDate End/due date (Unix timestamp)
 * @returns Array of milestones with evenly-spaced due dates
 */
export function generateEvenlySpacedMilestones(
  totalAmount: bigint,
  numInstallments: number,
  startDate: number,
  endDate: number
): InstallmentMilestone[] {
  const milestones: InstallmentMilestone[] = [];
  const amountPerInstallment = totalAmount / BigInt(numInstallments);
  const timeSpan = endDate - startDate;
  const timePerInstallment = timeSpan / numInstallments;

  for (let i = 0; i < numInstallments; i++) {
    const dueDate = startDate + Math.floor(timePerInstallment * (i + 1));
    let amount = amountPerInstallment;

    // Handle remainder on last installment
    if (i === numInstallments - 1) {
      amount = totalAmount - amountPerInstallment * BigInt(i);
    }

    milestones.push({ dueDate, amount });
  }

  return milestones;
}

/**
 * Generate auto-suggested payment plans (2, 3, and 4 installments)
 * @param totalAmount Total invoice amount
 * @param deadline Invoice deadline (Unix timestamp)
 * @returns Array of suggested payment plans
 */
export function generateSuggestedPlans(
  totalAmount: bigint,
  deadline: number
): PaymentPlan[] {
  const now = Math.floor(Date.now() / 1000);
  const plans: PaymentPlan[] = [];

  // Suggest 2, 3, and 4 installment plans
  for (const numInstallments of [2, 3, 4]) {
    const milestones = generateEvenlySpacedMilestones(
      totalAmount,
      numInstallments,
      now,
      deadline
    );

    const financingFeePercentage = numInstallments > 1 ? 2 : 0; // 2% for multiple installments
    const effectiveCost = calculateEffectiveCost(
      totalAmount,
      numInstallments,
      financingFeePercentage
    );

    plans.push({
      numInstallments,
      milestones,
      totalAmount,
      effectiveCost,
      financingFeePercentage,
    });
  }

  return plans;
}

/**
 * Calculate the financing fee amount for a plan
 */
export function getFinancingFeeAmount(plan: PaymentPlan): bigint {
  return plan.effectiveCost - plan.totalAmount;
}

/**
 * Format a plan for display
 */
export function formatPlanForDisplay(plan: PaymentPlan): {
  title: string;
  description: string;
  dueDates: string[];
  amounts: string[];
  financing: string;
  total: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });

  return {
    title: `${plan.numInstallments} Payment${plan.numInstallments > 1 ? 's' : ''}`,
    description: `Split into ${plan.numInstallments} equal installment${
      plan.numInstallments > 1 ? 's' : ''
    }`,
    dueDates: plan.milestones.map((m) =>
      formatter.format(new Date(m.dueDate * 1000))
    ),
    amounts: plan.milestones.map((m) =>
      (Number(m.amount) / 10000000).toFixed(2)
    ),
    financing:
      plan.financingFeePercentage > 0
        ? `${plan.financingFeePercentage}% financing`
        : 'No financing fee',
    total: (Number(plan.effectiveCost) / 10000000).toFixed(2),
  };
}
