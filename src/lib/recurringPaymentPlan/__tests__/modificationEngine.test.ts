import { describe, it, expect } from 'vitest';
import { modifyPlan, validateIntervalConfig } from '../modificationEngine';
import { executePayment } from '../scheduleEngine';
import type { RecurringPaymentPlan } from '@/types/recurringPaymentPlan';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function createBasePlan(): RecurringPaymentPlan {
  const now = new Date('2025-01-01T00:00:00Z').getTime();
  return {
    id: 'test_plan_mod',
    title: 'Original Title',
    payerAddress: 'G...Payer',
    recipientAddress: 'G...Recipient',
    status: 'active',
    startDate: now,
    currentCycle: 0,
    nextExecutionDate: now,
    lastExecutionDate: null,
    intervalConfig: {
      frequency: 'monthly',
      intervalCount: 1,
      dayOfMonth: 1,
    },
    amountConfig: {
      type: 'fixed',
      baseAmount: 100,
      currency: 'USDC',
    },
    executions: [],
    modifications: [],
    pauseHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('Plan Modification Engine', () => {
  describe('validateIntervalConfig', () => {
    it('accepts valid intervals', () => {
      expect(validateIntervalConfig({ intervalCount: 2, dayOfMonth: 15 }).valid).toBe(true);
    });

    it('rejects invalid interval counts or days', () => {
      const res = validateIntervalConfig({ intervalCount: 0, dayOfMonth: 32 });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('intervalCount must be at least 1');
      expect(res.errors).toContain('dayOfMonth must be between 1 and 31');
    });
  });

  describe('modifyPlan', () => {
    it('prevents modification of completed or cancelled plans', () => {
      const plan = createBasePlan();
      plan.status = 'completed';

      const res = modifyPlan(plan, { title: 'New Title' });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot modify a plan that is 'completed'");

      plan.status = 'cancelled';
      const res2 = modifyPlan(plan, { title: 'New Title' });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("Cannot modify a plan that is 'cancelled'");
    });

    it('prevents setting maxCycles lower than already executed cycles', () => {
      let plan = createBasePlan();
      // Execute 3 cycles
      plan = executePayment(plan, plan.startDate).plan;
      plan = executePayment(plan, plan.nextExecutionDate!).plan;
      plan = executePayment(plan, plan.nextExecutionDate!).plan;
      expect(plan.currentCycle).toBe(3);

      const res = modifyPlan(plan, { maxCycles: 2 });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot reduce maxCycles (2) below already completed cycles (3)');

      const validRes = modifyPlan(plan, { maxCycles: 5 });
      expect(validRes.success).toBe(true);
      expect(validRes.plan.maxCycles).toBe(5);
    });

    it('prevents setting endDate prior to last executed payment date', () => {
      let plan = createBasePlan();
      const lastExec = plan.startDate + 10 * MS_PER_DAY;
      plan = executePayment(plan, lastExec).plan;

      const res = modifyPlan(plan, { endDate: plan.startDate + 5 * MS_PER_DAY });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot set endDate before the last executed payment date');
    });

    it('safely modifies intervalConfig and recalculates upcoming schedule date', () => {
      const plan = createBasePlan();
      const res = modifyPlan(plan, {
        intervalConfig: {
          frequency: 'weekly',
          intervalCount: 2,
        },
      });

      expect(res.success).toBe(true);
      expect(res.plan.intervalConfig.frequency).toBe('weekly');
      expect(res.plan.intervalConfig.intervalCount).toBe(2);
      // Next cycle is 1 (currentCycle 0 + 1 = 1) at startDate
      expect(res.plan.nextExecutionDate).toBe(plan.startDate);
    });

    it('safely modifies amountConfig without altering past executions', () => {
      let plan = createBasePlan();
      // Execute cycle 1 with 100 USDC
      plan = executePayment(plan, plan.startDate).plan;
      expect(plan.executions[0].amount).toBe(100);

      // Modify amountConfig to 200 USDC
      const res = modifyPlan(
        plan,
        {
          amountConfig: {
            ...plan.amountConfig,
            baseAmount: 200,
          },
        },
        { reason: 'Price tier upgrade' }
      );

      expect(res.success).toBe(true);
      // Past execution remains strictly immutable
      expect(res.plan.executions[0].amount).toBe(100);
      expect(res.plan.amountConfig.baseAmount).toBe(200);

      // Execute next payment (cycle 2) and verify it receives the new 200 amount
      const exec2 = executePayment(res.plan, res.plan.nextExecutionDate!);
      expect(exec2.success).toBe(true);
      expect(exec2.execution?.cycle).toBe(2);
      expect(exec2.execution?.amount).toBe(200);
    });

    it('validates recipient split percentages total 100%', () => {
      const plan = createBasePlan();
      const invalidRes = modifyPlan(plan, {
        recipients: [
          { address: 'G...A', sharePercentage: 60 },
          { address: 'G...B', sharePercentage: 30 },
        ],
      });
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toContain('Recipient share percentages must total 100%');

      const validRes = modifyPlan(plan, {
        recipients: [
          { address: 'G...A', sharePercentage: 60 },
          { address: 'G...B', sharePercentage: 40 },
        ],
      });
      expect(validRes.success).toBe(true);
    });

    it('records detailed audit trail of all changes', () => {
      const plan = createBasePlan();
      const res = modifyPlan(
        plan,
        {
          title: 'Updated Plan Title',
          description: 'Updated Description',
        },
        { reason: 'Annual review' }
      );

      expect(res.success).toBe(true);
      expect(res.plan.modifications).toHaveLength(2);
      const titleMod = res.plan.modifications.find((m) => m.field === 'title');
      expect(titleMod).toBeDefined();
      expect(titleMod?.oldValue).toBe('Original Title');
      expect(titleMod?.newValue).toBe('Updated Plan Title');
      expect(titleMod?.reason).toBe('Annual review');
      expect(titleMod?.effectiveFromCycle).toBe(1);
    });
  });
});
