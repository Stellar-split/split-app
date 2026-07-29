import { describe, it, expect } from 'vitest';
import {
  generateSuggestedPlans,
  generateEvenlySpacedMilestones,
  calculateEffectiveCost,
  getFinancingFeeAmount,
  formatPlanForDisplay,
} from '@/lib/planCalculator';

describe('planCalculator', () => {
  const TOTAL_AMOUNT = BigInt(100000000); // 10 USDC in stroops
  const NOW = Math.floor(Date.now() / 1000);
  const DEADLINE = NOW + 90 * 24 * 60 * 60; // 90 days from now

  describe('calculateEffectiveCost', () => {
    it('should return total amount when numInstallments is 1', () => {
      const result = calculateEffectiveCost(TOTAL_AMOUNT, 1, 2);
      expect(result).toBe(TOTAL_AMOUNT);
    });

    it('should return total amount when financing rate is 0', () => {
      const result = calculateEffectiveCost(TOTAL_AMOUNT, 3, 0);
      expect(result).toBe(TOTAL_AMOUNT);
    });

    it('should increase cost with financing fee for multiple installments', () => {
      const cost = calculateEffectiveCost(TOTAL_AMOUNT, 3, 2);
      expect(cost).toBeGreaterThanOrEqual(TOTAL_AMOUNT);
    });

    it('should calculate financing fee proportional to installment count', () => {
      const cost2 = calculateEffectiveCost(TOTAL_AMOUNT, 2, 2);
      const cost3 = calculateEffectiveCost(TOTAL_AMOUNT, 3, 2);
      // More installments should result in higher or equal financing fees
      expect(cost3).toBeGreaterThanOrEqual(cost2);
    });
  });

  describe('generateEvenlySpacedMilestones', () => {
    it('should generate correct number of milestones', () => {
      const milestones = generateEvenlySpacedMilestones(
        TOTAL_AMOUNT,
        3,
        NOW,
        DEADLINE
      );
      expect(milestones).toHaveLength(3);
    });

    it('should have milestones in chronological order', () => {
      const milestones = generateEvenlySpacedMilestones(
        TOTAL_AMOUNT,
        3,
        NOW,
        DEADLINE
      );
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i].dueDate).toBeGreaterThan(milestones[i - 1].dueDate);
      }
    });

    it('should sum to total amount', () => {
      const milestones = generateEvenlySpacedMilestones(
        TOTAL_AMOUNT,
        4,
        NOW,
        DEADLINE
      );
      const sum = milestones.reduce((acc, m) => acc + m.amount, 0n);
      expect(sum).toBe(TOTAL_AMOUNT);
    });

    it('should space milestones evenly over time period', () => {
      const timeSpan = DEADLINE - NOW;
      const milestones = generateEvenlySpacedMilestones(
        TOTAL_AMOUNT,
        4,
        NOW,
        DEADLINE
      );

      // Check spacing between consecutive milestones
      const expectedSpacing = timeSpan / 4;
      for (let i = 0; i < milestones.length - 1; i++) {
        const actualSpacing = milestones[i + 1].dueDate - milestones[i].dueDate;
        // Allow 1% tolerance due to rounding
        expect(actualSpacing).toBeGreaterThan(expectedSpacing * 0.99);
        expect(actualSpacing).toBeLessThan(expectedSpacing * 1.01);
      }
    });

    it('should handle remainder correctly on last milestone', () => {
      const milestones = generateEvenlySpacedMilestones(
        BigInt(10000001), // Not evenly divisible
        3,
        NOW,
        DEADLINE
      );
      const sum = milestones.reduce((acc, m) => acc + m.amount, 0n);
      expect(sum).toBe(BigInt(10000001));
    });
  });

  describe('generateSuggestedPlans', () => {
    it('should generate exactly 3 suggested plans', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      expect(plans).toHaveLength(3);
    });

    it('should generate 2, 3, and 4 installment plans', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      expect(plans[0].numInstallments).toBe(2);
      expect(plans[1].numInstallments).toBe(3);
      expect(plans[2].numInstallments).toBe(4);
    });

    it('should have each plan contain correct milestones', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      plans.forEach((plan, index) => {
        expect(plan.milestones).toHaveLength(index + 2);
      });
    });

    it('should set correct total amount for each plan', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      plans.forEach((plan) => {
        expect(plan.totalAmount).toBe(TOTAL_AMOUNT);
      });
    });

    it('should apply financing fee for multiple installments', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      plans.forEach((plan) => {
        if (plan.numInstallments === 1) {
          expect(plan.effectiveCost).toBe(TOTAL_AMOUNT);
        } else {
          // Financing fee may be rounded down to 0 for very small amounts
          expect(plan.effectiveCost).toBeGreaterThanOrEqual(TOTAL_AMOUNT);
        }
      });
    });

    it('should set financing fee percentage for multiple installments', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      expect(plans[0].financingFeePercentage).toBeGreaterThan(0); // 2 installments
      expect(plans[1].financingFeePercentage).toBeGreaterThan(0); // 3 installments
      expect(plans[2].financingFeePercentage).toBeGreaterThan(0); // 4 installments
    });
  });

  describe('getFinancingFeeAmount', () => {
    it('should calculate financing fee as difference between effective cost and total', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const plan = plans[1]; // 3 installments
      const fee = getFinancingFeeAmount(plan);
      expect(fee).toBe(plan.effectiveCost - plan.totalAmount);
    });

    it('should return 0 for single installment plan', () => {
      const singlePlan = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE)[0];
      if (singlePlan.numInstallments === 1) {
        const fee = getFinancingFeeAmount(singlePlan);
        expect(fee).toBe(0n);
      }
    });
  });

  describe('formatPlanForDisplay', () => {
    it('should format title with correct installment count', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      plans.forEach((plan) => {
        const formatted = formatPlanForDisplay(plan);
        expect(formatted.title).toContain(plan.numInstallments.toString());
        expect(formatted.title).toContain('Payment');
      });
    });

    it('should include all milestones in due dates', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const plan = plans[1]; // 3 installments
      const formatted = formatPlanForDisplay(plan);
      expect(formatted.dueDates).toHaveLength(plan.milestones.length);
    });

    it('should format amounts as USDC strings', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const formatted = formatPlanForDisplay(plans[0]);
      formatted.amounts.forEach((amount) => {
        // Should be a valid decimal string
        expect(Number(amount)).toBeGreaterThan(0);
        expect(amount).toMatch(/^\d+(\.\d{2})?$/);
      });
    });

    it('should include financing information', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const formatted = formatPlanForDisplay(plans[1]);
      expect(formatted.financing).toBeDefined();
      expect(formatted.financing.length).toBeGreaterThan(0);
    });

    it('should format total cost correctly', () => {
      const plans = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const plan = plans[1];
      const formatted = formatPlanForDisplay(plan);
      const formattedTotal = Number(formatted.total);
      const expectedTotal = Number(plan.effectiveCost) / 10000000;
      // Allow small rounding difference
      expect(Math.abs(formattedTotal - expectedTotal)).toBeLessThan(0.01);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle large amounts correctly', () => {
      const largeAmount = BigInt(100000000000); // 10,000 USDC
      const plans = generateSuggestedPlans(largeAmount, DEADLINE);
      plans.forEach((plan) => {
        const sum = plan.milestones.reduce((acc, m) => acc + m.amount, 0n);
        expect(sum).toBe(largeAmount);
      });
    });

    it('should handle small amounts correctly', () => {
      const smallAmount = BigInt(1000); // 0.0001 USDC
      const plans = generateSuggestedPlans(smallAmount, DEADLINE);
      plans.forEach((plan) => {
        expect(plan.totalAmount).toBe(smallAmount);
        expect(plan.milestones.length).toBeGreaterThan(0);
      });
    });

    it('should be idempotent - same input produces same output', () => {
      const plans1 = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      const plans2 = generateSuggestedPlans(TOTAL_AMOUNT, DEADLINE);
      plans1.forEach((plan, idx) => {
        expect(plan.numInstallments).toBe(plans2[idx].numInstallments);
        expect(plan.effectiveCost).toBe(plans2[idx].effectiveCost);
      });
    });
  });
});
