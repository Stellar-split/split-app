import { describe, it, expect } from 'vitest';
import {
  calculateCycleAmount,
  roundAmount,
  validateAmountConfig,
  projectTotalAmount,
} from '../amountEngine';
import type { PlanAmountConfig } from '@/types/recurringPaymentPlan';

describe('Amount Variation Engine', () => {
  describe('roundAmount', () => {
    it('correctly rounds to specified decimal places', () => {
      expect(roundAmount(10.123456789, 7)).toBe(10.1234568);
      expect(roundAmount(10.555, 2)).toBe(10.56);
      expect(roundAmount(NaN)).toBe(0);
      expect(roundAmount(Infinity)).toBe(0);
    });
  });

  describe('validateAmountConfig', () => {
    it('validates fixed amount configuration', () => {
      const config: PlanAmountConfig = {
        type: 'fixed',
        baseAmount: 100,
        currency: 'USDC',
      };
      const res = validateAmountConfig(config);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects negative baseAmount and invalid currency', () => {
      const config: PlanAmountConfig = {
        type: 'fixed',
        baseAmount: -50,
        currency: '',
      };
      const res = validateAmountConfig(config);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('baseAmount must be a non-negative number');
      expect(res.errors).toContain('currency is required');
    });

    it('rejects minimumAmount exceeding maximumAmount', () => {
      const config: PlanAmountConfig = {
        type: 'fixed',
        baseAmount: 100,
        currency: 'USDC',
        minimumAmount: 200,
        maximumAmount: 150,
      };
      const res = validateAmountConfig(config);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('minimumAmount cannot exceed maximumAmount');
    });

    it('validates scheduled amount variations', () => {
      const config: PlanAmountConfig = {
        type: 'scheduled',
        baseAmount: 100,
        currency: 'USDC',
        scheduledAmounts: [
          { cycle: 1, amount: 100 },
          { cycle: 2, amount: 150 },
        ],
      };
      expect(validateAmountConfig(config).valid).toBe(true);

      const invalid: PlanAmountConfig = {
        type: 'scheduled',
        baseAmount: 100,
        currency: 'USDC',
        scheduledAmounts: [{ cycle: 0, amount: -10 }],
      };
      const invRes = validateAmountConfig(invalid);
      expect(invRes.valid).toBe(false);
      expect(invRes.errors).toContain('Cycle must be >= 1 (got 0)');
      expect(invRes.errors).toContain('Amount for cycle 0 cannot be negative');
    });

    it('validates tiered amount variations', () => {
      const config: PlanAmountConfig = {
        type: 'tiered',
        baseAmount: 100,
        currency: 'USDC',
        tieredAmounts: [
          { upToCycle: 3, amount: 80 },
          { upToCycle: 6, amount: 120 },
        ],
      };
      expect(validateAmountConfig(config).valid).toBe(true);
    });

    it('validates percentage_step variations', () => {
      const config: PlanAmountConfig = {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 10,
          stepFrequencyCycles: 2,
        },
      };
      expect(validateAmountConfig(config).valid).toBe(true);

      const invalid: PlanAmountConfig = {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 10,
          stepFrequencyCycles: 0,
        },
      };
      expect(validateAmountConfig(invalid).valid).toBe(false);
    });
  });

  describe('calculateCycleAmount', () => {
    it('throws error for cycle index < 1', () => {
      const config: PlanAmountConfig = { type: 'fixed', baseAmount: 100, currency: 'USDC' };
      expect(() => calculateCycleAmount(config, 0)).toThrow('Cycle index must be positive');
    });

    it('returns fixed baseAmount for all cycles in fixed mode', () => {
      const config: PlanAmountConfig = { type: 'fixed', baseAmount: 125.5, currency: 'USDC' };
      expect(calculateCycleAmount(config, 1)).toBe(125.5);
      expect(calculateCycleAmount(config, 5)).toBe(125.5);
      expect(calculateCycleAmount(config, 20)).toBe(125.5);
    });

    it('returns exact scheduled amounts and extrapolates beyond highest cycle', () => {
      const config: PlanAmountConfig = {
        type: 'scheduled',
        baseAmount: 50,
        currency: 'USDC',
        scheduledAmounts: [
          { cycle: 1, amount: 100 },
          { cycle: 2, amount: 150 },
          { cycle: 4, amount: 250 },
        ],
      };
      expect(calculateCycleAmount(config, 1)).toBe(100);
      expect(calculateCycleAmount(config, 2)).toBe(150);
      // For cycle 3 (gap between 2 and 4), falls back to cycle 2 amount
      expect(calculateCycleAmount(config, 3)).toBe(150);
      expect(calculateCycleAmount(config, 4)).toBe(250);
      // Beyond cycle 4, uses last defined schedule amount (250)
      expect(calculateCycleAmount(config, 10)).toBe(250);
    });

    it('applies tiered amounts according to upToCycle thresholds', () => {
      const config: PlanAmountConfig = {
        type: 'tiered',
        baseAmount: 50,
        currency: 'USDC',
        tieredAmounts: [
          { upToCycle: 2, amount: 60 },
          { upToCycle: 5, amount: 90 },
          { upToCycle: 8, amount: 120 },
        ],
      };
      expect(calculateCycleAmount(config, 1)).toBe(60);
      expect(calculateCycleAmount(config, 2)).toBe(60);
      expect(calculateCycleAmount(config, 3)).toBe(90);
      expect(calculateCycleAmount(config, 5)).toBe(90);
      expect(calculateCycleAmount(config, 6)).toBe(120);
      expect(calculateCycleAmount(config, 8)).toBe(120);
      // Beyond highest tier, uses final tier amount
      expect(calculateCycleAmount(config, 12)).toBe(120);
    });

    it('calculates compound percentage step increases accurately', () => {
      const config: PlanAmountConfig = {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 10, // +10%
          stepFrequencyCycles: 2, // every 2 cycles (steps on cycle 3, 5, 7...)
          compound: true,
        },
      };
      // Cycle 1: step 0 -> 100
      expect(calculateCycleAmount(config, 1)).toBe(100);
      // Cycle 2: step 0 -> 100
      expect(calculateCycleAmount(config, 2)).toBe(100);
      // Cycle 3: step 1 -> 100 * 1.1 = 110
      expect(calculateCycleAmount(config, 3)).toBe(110);
      // Cycle 4: step 1 -> 110
      expect(calculateCycleAmount(config, 4)).toBe(110);
      // Cycle 5: step 2 -> 100 * 1.1^2 = 121
      expect(calculateCycleAmount(config, 5)).toBe(121);
    });

    it('calculates linear percentage step increases accurately', () => {
      const config: PlanAmountConfig = {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 10,
          stepFrequencyCycles: 1, // every single cycle
          compound: false,
        },
      };
      expect(calculateCycleAmount(config, 1)).toBe(100);
      expect(calculateCycleAmount(config, 2)).toBe(110);
      expect(calculateCycleAmount(config, 3)).toBe(120);
      expect(calculateCycleAmount(config, 4)).toBe(130);
    });

    it('respects minAmount and maxAmount bounds on percentage step and global', () => {
      const config: PlanAmountConfig = {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 50,
          stepFrequencyCycles: 1,
          compound: true,
          maxAmount: 200,
        },
        maximumAmount: 180, // stricter global cap
      };
      expect(calculateCycleAmount(config, 1)).toBe(100);
      expect(calculateCycleAmount(config, 2)).toBe(150);
      // Cycle 3 would be 225, capped at 180
      expect(calculateCycleAmount(config, 3)).toBe(180);
    });

    it('handles milestone amounts on specific cycles', () => {
      const config: PlanAmountConfig = {
        type: 'milestone',
        baseAmount: 100,
        currency: 'USDC',
        milestoneAmounts: [
          { cycle: 3, amount: 250 },
          { cycle: 6, amount: 500 },
        ],
      };
      expect(calculateCycleAmount(config, 1)).toBe(100);
      expect(calculateCycleAmount(config, 2)).toBe(100);
      expect(calculateCycleAmount(config, 3)).toBe(250);
      expect(calculateCycleAmount(config, 4)).toBe(100);
      expect(calculateCycleAmount(config, 6)).toBe(500);
    });
  });

  describe('projectTotalAmount', () => {
    it('accurately projects total sum over cycle ranges', () => {
      const config: PlanAmountConfig = {
        type: 'fixed',
        baseAmount: 100,
        currency: 'USDC',
      };
      expect(projectTotalAmount(config, 1, 5)).toBe(500);
      expect(projectTotalAmount(config, 3, 2)).toBe(0);
    });

    it('projects varying amounts accurately across cycles', () => {
      const config: PlanAmountConfig = {
        type: 'tiered',
        baseAmount: 50,
        currency: 'USDC',
        tieredAmounts: [
          { upToCycle: 2, amount: 50 },
          { upToCycle: 4, amount: 100 },
        ],
      };
      // Cycle 1: 50, Cycle 2: 50, Cycle 3: 100, Cycle 4: 100 -> Sum = 300
      expect(projectTotalAmount(config, 1, 4)).toBe(300);
    });
  });
});
