import { describe, it, expect } from 'vitest';
import {
  executePayment,
  getDueExecutions,
  catchUpDuePayments,
} from '../scheduleEngine';
import { modifyPlan } from '../modificationEngine';
import { pausePlan, resumePlan } from '../pauseResumeEngine';
import { calculatePlanAnalytics, calculatePortfolioAnalytics } from '../analyticsEngine';
import type { RecurringPaymentPlan } from '@/types/recurringPaymentPlan';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('Recurring Payment Plan End-to-End Lifecycle', () => {
  it('fulfills all acceptance criteria across the complete lifecycle', async () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();

    // 1. Requirement & Criterion: Design payment plan structure & Plans execute on schedule
    let plan: RecurringPaymentPlan = {
      id: 'plan_e2e_101',
      title: 'Tiered Creator Contract',
      payerAddress: 'G...PayerAddress',
      recipientAddress: 'G...RecipientAddress',
      status: 'active',
      startDate: start,
      currentCycle: 0,
      nextExecutionDate: start,
      lastExecutionDate: null,
      maxCycles: 6,
      intervalConfig: {
        frequency: 'weekly',
        intervalCount: 1,
      },
      // 2. Requirement & Criterion: Add amount variation support & Amounts vary correctly
      amountConfig: {
        type: 'percentage_step',
        baseAmount: 100,
        currency: 'USDC',
        percentageStep: {
          percentageChange: 10, // +10%
          stepFrequencyCycles: 2, // every 2 cycles (steps on cycle 3, 5)
          compound: true,
        },
      },
      executions: [],
      modifications: [],
      pauseHistory: [],
      createdAt: start,
      updatedAt: start,
    };

    // --- Execution 1: Cycle 1 on schedule ---
    let execResult = executePayment(plan, start);
    expect(execResult.success).toBe(true);
    expect(execResult.execution?.cycle).toBe(1);
    expect(execResult.execution?.amount).toBe(100);
    plan = execResult.plan;
    expect(plan.currentCycle).toBe(1);
    expect(plan.nextExecutionDate).toBe(start + 7 * MS_PER_DAY);

    // --- Execution 2: Cycle 2 on schedule ---
    execResult = executePayment(plan, plan.nextExecutionDate!);
    expect(execResult.success).toBe(true);
    expect(execResult.execution?.cycle).toBe(2);
    expect(execResult.execution?.amount).toBe(100);
    plan = execResult.plan;
    expect(plan.currentCycle).toBe(2);
    expect(plan.nextExecutionDate).toBe(start + 14 * MS_PER_DAY);

    // --- Execution 3: Cycle 3 (+10% variation applied correctly) ---
    execResult = executePayment(plan, plan.nextExecutionDate!);
    expect(execResult.success).toBe(true);
    expect(execResult.execution?.cycle).toBe(3);
    expect(execResult.execution?.amount).toBe(110); // 100 * 1.1
    plan = execResult.plan;

    // 3. Requirement & Criterion: Implement pause/resume functionality & Pause/resume works
    const pauseTime = start + 16 * MS_PER_DAY; // 2 days after cycle 3
    const pauseResult = pausePlan(plan, pauseTime, 'Temporary hold for contract review');
    expect(pauseResult.success).toBe(true);
    plan = pauseResult.plan;
    expect(plan.status).toBe('paused');

    // While paused, no payments should be executed or due
    expect(executePayment(plan, start + 21 * MS_PER_DAY).success).toBe(false);
    expect(getDueExecutions(plan, start + 21 * MS_PER_DAY)).toHaveLength(0);

    // Resume after 2 weeks have elapsed (Jan 30)
    const resumeTime = start + 30 * MS_PER_DAY;
    const resumeResult = resumePlan(plan, resumeTime, 'catch_up');
    expect(resumeResult.success).toBe(true);
    plan = resumeResult.plan;
    expect(plan.status).toBe('active');

    // 4. Requirement & Criterion: No missed payments (catch-up due payments)
    const dueDuringPause = getDueExecutions(plan, resumeTime);
    expect(dueDuringPause.length).toBeGreaterThanOrEqual(1);

    const catchUpResult = await catchUpDuePayments(plan, resumeTime);
    expect(catchUpResult.executedCount).toBe(dueDuringPause.length);
    expect(catchUpResult.errors).toHaveLength(0);
    plan = catchUpResult.plan;

    // Verify all missed payments were caught up
    const remainingDue = getDueExecutions(plan, resumeTime);
    expect(remainingDue).toHaveLength(0);

    // 5. Requirement & Criterion: Create plan modification logic & Modifications apply safely
    const modResult = modifyPlan(
      plan,
      {
        title: 'Tiered Creator Contract (Amended)',
        amountConfig: {
          ...plan.amountConfig,
          baseAmount: 150, // Amended base amount
        },
      },
      { reason: 'Approved rate revision' }
    );
    expect(modResult.success).toBe(true);
    plan = modResult.plan;

    // Verify past executions are immutable
    expect(plan.executions[0].amount).toBe(100);
    expect(plan.executions[1].amount).toBe(100);
    expect(plan.executions[2].amount).toBe(110);
    expect(plan.modifications.length).toBeGreaterThan(0);

    // 6. Complete remaining cycles until maxCycles
    while (plan.status === 'active') {
      const nextDate = plan.nextExecutionDate!;
      const r = executePayment(plan, nextDate);
      if (!r.success) break;
      plan = r.plan;
    }

    expect(plan.status).toBe('completed');
    expect(plan.currentCycle).toBe(6);
    expect(plan.nextExecutionDate).toBeNull();

    // 7. Requirement & Criterion: Add payment plan analytics & Analytics accurate
    const stats = calculatePlanAnalytics(plan);
    expect(stats.completedCycles).toBe(6);
    expect(stats.remainingCycles).toBe(0);
    expect(stats.completionPercentage).toBe(100);
    expect(stats.missedPaymentsCount).toBe(0);
    expect(stats.timesPaused).toBe(1);
    expect(stats.totalPausedDurationMs).toBe(resumeTime - pauseTime);
    expect(stats.totalAmountPaid).toBeGreaterThan(0);

    const portfolio = calculatePortfolioAnalytics([plan]);
    expect(portfolio.totalPlans).toBe(1);
    expect(portfolio.completedPlans).toBe(1);
    expect(portfolio.completionRate).toBe(100);
    expect(portfolio.totalMissedPayments).toBe(0);
  });
});
