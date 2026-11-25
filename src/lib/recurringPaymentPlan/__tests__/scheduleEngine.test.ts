import { describe, it, expect } from 'vitest';
import {
  addIntervalToDate,
  calculateScheduledDateForCycle,
  getDueExecutions,
  executePayment,
  catchUpDuePayments,
  generateUpcomingSchedule,
} from '../scheduleEngine';
import type { RecurringPaymentPlan } from '@/types/recurringPaymentPlan';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function createBasePlan(overrides: Partial<RecurringPaymentPlan> = {}): RecurringPaymentPlan {
  const now = new Date('2025-01-01T00:00:00Z').getTime();
  return {
    id: 'test_plan_1',
    title: 'Test Subscription',
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
    ...overrides,
  };
}

describe('Schedule Engine', () => {
  describe('addIntervalToDate', () => {
    const base = new Date('2025-01-01T12:00:00Z').getTime();

    it('adds daily intervals accurately', () => {
      const result = addIntervalToDate(base, { frequency: 'daily', intervalCount: 3 });
      expect(result).toBe(base + 3 * MS_PER_DAY);
    });

    it('adds weekly intervals accurately', () => {
      const result = addIntervalToDate(base, { frequency: 'weekly', intervalCount: 2 });
      expect(result).toBe(base + 14 * MS_PER_DAY);
    });

    it('adds biweekly intervals accurately', () => {
      const result = addIntervalToDate(base, { frequency: 'biweekly', intervalCount: 1 });
      expect(result).toBe(base + 14 * MS_PER_DAY);
    });

    it('adds monthly intervals and handles month boundaries', () => {
      const jan15 = new Date('2025-01-15T00:00:00Z').getTime();
      const feb15 = addIntervalToDate(jan15, { frequency: 'monthly', intervalCount: 1 });
      const febDate = new Date(feb15);
      expect(febDate.getMonth()).toBe(1); // Feb
      expect(febDate.getDate()).toBe(15);
    });

    it('clamps month-end dates safely (e.g. Jan 31 -> Feb 28 in non-leap year)', () => {
      const jan31 = new Date('2025-01-31T00:00:00Z').getTime();
      const feb = addIntervalToDate(jan31, { frequency: 'monthly', intervalCount: 1 });
      const febDate = new Date(feb);
      expect(febDate.getMonth()).toBe(1); // Feb
      expect(febDate.getDate()).toBe(28); // 2025 is not a leap year
    });

    it('handles leap years on month-end clamping (Jan 31 -> Feb 29 in 2024)', () => {
      const jan31_2024 = new Date('2024-01-31T00:00:00Z').getTime();
      const feb2024 = addIntervalToDate(jan31_2024, { frequency: 'monthly', intervalCount: 1 });
      const febDate = new Date(feb2024);
      expect(febDate.getMonth()).toBe(1); // Feb
      expect(febDate.getDate()).toBe(29); // 2024 is a leap year
    });

    it('adds quarterly intervals (every 3 months)', () => {
      const jan1 = new Date('2025-01-01T00:00:00Z').getTime();
      const apr1 = addIntervalToDate(jan1, { frequency: 'quarterly', intervalCount: 1 });
      const aprDate = new Date(apr1);
      expect(aprDate.getMonth()).toBe(3); // April
      expect(aprDate.getDate()).toBe(1);
    });

    it('adds yearly intervals', () => {
      const jan1_2025 = new Date('2025-01-01T00:00:00Z').getTime();
      const jan1_2026 = addIntervalToDate(jan1_2025, { frequency: 'yearly', intervalCount: 1 });
      expect(new Date(jan1_2026).getFullYear()).toBe(2026);
    });

    it('adds custom intervals in days', () => {
      const res = addIntervalToDate(base, { frequency: 'custom', intervalCount: 1, customIntervalDays: 10 });
      expect(res).toBe(base + 10 * MS_PER_DAY);
    });
  });

  describe('calculateScheduledDateForCycle', () => {
    it('sets cycle 1 at startDate and cycle 2 at startDate + interval', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        intervalConfig: { frequency: 'weekly', intervalCount: 1 },
      });

      expect(calculateScheduledDateForCycle(plan, 1)).toBe(start);
      expect(calculateScheduledDateForCycle(plan, 2)).toBe(start + 7 * MS_PER_DAY);
      expect(calculateScheduledDateForCycle(plan, 4)).toBe(start + 21 * MS_PER_DAY);
    });
  });

  describe('getDueExecutions and No Missed Payments guarantee', () => {
    it('returns empty when no payments are due yet', () => {
      const futureStart = Date.now() + 10 * MS_PER_DAY;
      const plan = createBasePlan({ startDate: futureStart, nextExecutionDate: futureStart });
      const due = getDueExecutions(plan, Date.now());
      expect(due).toHaveLength(0);
    });

    it('identifies all overdue cycles when multiple intervals have passed', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      // As of Jan 4 (3 days later), cycles 1, 2, 3, 4 should all be due
      const asOf = start + 3 * MS_PER_DAY;
      const due = getDueExecutions(plan, asOf);

      expect(due).toHaveLength(4);
      expect(due.map((d) => d.cycle)).toEqual([1, 2, 3, 4]);
      expect(due[0].isOverdue).toBe(true);
    });

    it('returns empty when plan is paused', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        status: 'paused',
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      const due = getDueExecutions(plan, start + 5 * MS_PER_DAY);
      expect(due).toHaveLength(0);
    });

    it('respects maxCycles limit when finding due payments', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        maxCycles: 2,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      const due = getDueExecutions(plan, start + 10 * MS_PER_DAY);
      expect(due).toHaveLength(2);
      expect(due.map((d) => d.cycle)).toEqual([1, 2]);
    });

    it('respects endDate limit when finding due payments', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        endDate: start + 2 * MS_PER_DAY, // only covers up to cycle 3
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      const due = getDueExecutions(plan, start + 10 * MS_PER_DAY);
      expect(due).toHaveLength(3); // cycles 1, 2, 3
    });
  });

  describe('executePayment', () => {
    it('successfully executes a payment and advances cycle and nextExecutionDate', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        intervalConfig: { frequency: 'weekly', intervalCount: 1 },
        amountConfig: { type: 'fixed', baseAmount: 250, currency: 'USDC' },
      });

      const result = executePayment(plan, start);
      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution?.cycle).toBe(1);
      expect(result.execution?.amount).toBe(250);
      expect(result.plan.currentCycle).toBe(1);
      expect(result.plan.lastExecutionDate).toBe(start);
      expect(result.plan.nextExecutionDate).toBe(start + 7 * MS_PER_DAY);
      expect(result.plan.executions).toHaveLength(1);
      expect(result.plan.status).toBe('active');
    });

    it('auto-completes when maxCycles is reached', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        maxCycles: 1,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      const result = executePayment(plan, start);
      expect(result.success).toBe(true);
      expect(result.plan.status).toBe('completed');
      expect(result.plan.nextExecutionDate).toBeNull();
    });

    it('rejects execution on paused or cancelled plans', () => {
      const plan = createBasePlan({ status: 'paused' });
      const result = executePayment(plan, Date.now());
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot execute payment on a plan with status 'paused'");
    });
  });

  describe('catchUpDuePayments', () => {
    it('executes all due payments sequentially without missing any', async () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        intervalConfig: { frequency: 'weekly', intervalCount: 1 },
        amountConfig: {
          type: 'tiered',
          baseAmount: 100,
          currency: 'USDC',
          tieredAmounts: [
            { upToCycle: 1, amount: 100 },
            { upToCycle: 2, amount: 120 },
            { upToCycle: 3, amount: 140 },
          ],
        },
      });

      // 3 weeks have passed without execution
      const asOf = start + 2 * 7 * MS_PER_DAY; // covers cycles 1, 2, 3
      const result = await catchUpDuePayments(plan, asOf);

      expect(result.executedCount).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.plan.currentCycle).toBe(3);
      expect(result.plan.executions).toHaveLength(3);
      expect(result.plan.executions[0].amount).toBe(100);
      expect(result.plan.executions[1].amount).toBe(120);
      expect(result.plan.executions[2].amount).toBe(140);
      expect(result.plan.nextExecutionDate).toBe(start + 3 * 7 * MS_PER_DAY);
    });
  });

  describe('generateUpcomingSchedule', () => {
    it('generates upcoming schedule with amount variations and limits', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan({
        startDate: start,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
        amountConfig: {
          type: 'percentage_step',
          baseAmount: 100,
          currency: 'USDC',
          percentageStep: {
            percentageChange: 10,
            stepFrequencyCycles: 1,
            compound: false,
          },
        },
      });

      const schedule = generateUpcomingSchedule(plan, 3);
      expect(schedule).toHaveLength(3);
      expect(schedule[0].cycle).toBe(1);
      expect(schedule[0].amount).toBe(100);
      expect(schedule[1].cycle).toBe(2);
      expect(schedule[1].amount).toBe(110);
      expect(schedule[2].cycle).toBe(3);
      expect(schedule[2].amount).toBe(120);
    });
  });
});
