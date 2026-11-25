import { describe, it, expect } from 'vitest';
import {
  calculatePlanAnalytics,
  calculatePortfolioAnalytics,
} from '../analyticsEngine';
import { executePayment } from '../scheduleEngine';
import { pausePlan, resumePlan } from '../pauseResumeEngine';
import type { RecurringPaymentPlan } from '@/types/recurringPaymentPlan';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function createBasePlan(overrides: Partial<RecurringPaymentPlan> = {}): RecurringPaymentPlan {
  const now = new Date('2025-01-01T00:00:00Z').getTime();
  return {
    id: 'test_plan_analytics',
    title: 'Analytics Plan',
    payerAddress: 'G...Payer',
    recipientAddress: 'G...Recipient',
    status: 'active',
    startDate: now,
    currentCycle: 0,
    nextExecutionDate: now,
    lastExecutionDate: null,
    maxCycles: 5,
    intervalConfig: {
      frequency: 'monthly',
      intervalCount: 1,
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

describe('Payment Plan Analytics Engine', () => {
  describe('calculatePlanAnalytics', () => {
    it('computes accurate analytics for newly created plan with 0 executions', () => {
      const plan = createBasePlan({ maxCycles: 4, amountConfig: { type: 'fixed', baseAmount: 150, currency: 'USDC' } });
      const stats = calculatePlanAnalytics(plan, plan.startDate);

      expect(stats.totalCyclesPlanned).toBe(4);
      expect(stats.completedCycles).toBe(0);
      expect(stats.remainingCycles).toBe(4);
      expect(stats.totalAmountPaid).toBe(0);
      expect(stats.remainingProjectedAmount).toBe(600); // 4 * 150
      expect(stats.averagePaymentAmount).toBe(150);
      expect(stats.onTimeExecutionRate).toBe(100);
      expect(stats.completionPercentage).toBe(0);
    });

    it('computes accurate payment statistics across varying amounts', () => {
      let plan = createBasePlan({
        amountConfig: {
          type: 'tiered',
          baseAmount: 100,
          currency: 'USDC',
          tieredAmounts: [
            { upToCycle: 1, amount: 100 },
            { upToCycle: 2, amount: 200 },
            { upToCycle: 3, amount: 300 },
          ],
        },
      });

      // Execute 3 payments
      plan = executePayment(plan, plan.startDate).plan;
      plan = executePayment(plan, plan.nextExecutionDate!).plan;
      plan = executePayment(plan, plan.nextExecutionDate!).plan;

      const stats = calculatePlanAnalytics(plan);
      expect(stats.completedCycles).toBe(3);
      expect(stats.totalAmountPaid).toBe(600); // 100 + 200 + 300
      expect(stats.averagePaymentAmount).toBe(200);
      expect(stats.minPaymentAmount).toBe(100);
      expect(stats.maxPaymentAmount).toBe(300);
      expect(stats.amountVolatility).toBeGreaterThan(0);
    });

    it('computes accurate onTimeExecutionRate when payments are delayed', () => {
      const plan = createBasePlan();
      const sched1 = plan.startDate;
      const sched2 = plan.startDate + 30 * MS_PER_DAY;

      plan.executions = [
        // On time (same day)
        {
          id: '1',
          cycle: 1,
          scheduledDate: sched1,
          executedDate: sched1,
          amount: 100,
          currency: 'USDC',
          status: 'completed',
        },
        // Late by 5 days (> 24h tolerance)
        {
          id: '2',
          cycle: 2,
          scheduledDate: sched2,
          executedDate: sched2 + 5 * MS_PER_DAY,
          amount: 100,
          currency: 'USDC',
          status: 'completed',
        },
      ];

      const stats = calculatePlanAnalytics(plan, sched2 + 10 * MS_PER_DAY);
      expect(stats.onTimeExecutionRate).toBe(50); // 1 out of 2 on time
    });

    it('calculates missed payments count accurately', () => {
      const plan = createBasePlan({
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });
      // 5 days have passed with 0 executions
      const now = plan.startDate + 5 * MS_PER_DAY;
      const stats = calculatePlanAnalytics(plan, now);

      expect(stats.missedPaymentsCount).toBeGreaterThan(0);
    });

    it('tracks pause analytics accurately', () => {
      let plan = createBasePlan();
      plan = pausePlan(plan, plan.startDate + 1000).plan;
      plan = resumePlan(plan, plan.startDate + 4000).plan; // 3000 ms

      const stats = calculatePlanAnalytics(plan, plan.startDate + 5000);
      expect(stats.timesPaused).toBe(1);
      expect(stats.totalPausedDurationMs).toBe(3000);
    });
  });

  describe('calculatePortfolioAnalytics', () => {
    it('handles empty plans array safely without division by zero', () => {
      const portfolio = calculatePortfolioAnalytics([]);
      expect(portfolio.totalPlans).toBe(0);
      expect(portfolio.activePlans).toBe(0);
      expect(portfolio.totalVolumeCollected).toBe(0);
      expect(portfolio.totalProjectedVolume).toBe(0);
      expect(portfolio.averagePlanSize).toBe(0);
      expect(portfolio.overallOnTimeRate).toBe(100);
      expect(portfolio.pauseRate).toBe(0);
    });

    it('aggregates metrics across active, paused, and completed plans accurately', () => {
      const plan1 = createBasePlan({ id: 'p1', title: 'Plan 1', status: 'active' });
      const plan2 = createBasePlan({ id: 'p2', title: 'Plan 2', status: 'paused' });
      const plan3 = createBasePlan({ id: 'p3', title: 'Plan 3', status: 'completed' });
      const plan4 = createBasePlan({ id: 'p4', title: 'Plan 4', status: 'cancelled' });

      // Add execution to plan 3
      plan3.executions = [
        {
          id: 'e1',
          cycle: 1,
          scheduledDate: plan3.startDate,
          executedDate: plan3.startDate,
          amount: 500,
          currency: 'USDC',
          status: 'completed',
        },
      ];

      const portfolio = calculatePortfolioAnalytics([plan1, plan2, plan3, plan4]);

      expect(portfolio.totalPlans).toBe(4);
      expect(portfolio.activePlans).toBe(1);
      expect(portfolio.pausedPlans).toBe(1);
      expect(portfolio.completedPlans).toBe(1);
      expect(portfolio.cancelledPlans).toBe(1);
      expect(portfolio.totalVolumeCollected).toBe(500);
      expect(portfolio.volumeByCurrency['USDC'].collected).toBe(500);
      expect(portfolio.pauseRate).toBe(25);
      expect(portfolio.completionRate).toBe(25);
      expect(portfolio.churnRate).toBe(25);
    });

    it('forecasts upcoming cashflow chronologically', () => {
      const now = Date.now();
      const planA = createBasePlan({
        id: 'pA',
        title: 'Plan A',
        startDate: now + 5 * MS_PER_DAY,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });
      const planB = createBasePlan({
        id: 'pB',
        title: 'Plan B',
        startDate: now + 2 * MS_PER_DAY,
        intervalConfig: { frequency: 'daily', intervalCount: 1 },
      });

      const portfolio = calculatePortfolioAnalytics([planA, planB], { currentTime: now });
      expect(portfolio.upcomingCashflow.length).toBeGreaterThan(0);
      // Verifies chronological ordering
      for (let i = 0; i < portfolio.upcomingCashflow.length - 1; i++) {
        expect(portfolio.upcomingCashflow[i].date).toBeLessThanOrEqual(
          portfolio.upcomingCashflow[i + 1].date
        );
      }
    });
  });
});
