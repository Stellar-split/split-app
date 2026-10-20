import { describe, it, expect } from 'vitest';
import {
  pausePlan,
  resumePlan,
  isPlanPaused,
  calculateTotalPausedDuration,
} from '../pauseResumeEngine';
import { getDueExecutions } from '../scheduleEngine';
import type { RecurringPaymentPlan } from '@/types/recurringPaymentPlan';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function createBasePlan(): RecurringPaymentPlan {
  const now = new Date('2025-01-01T00:00:00Z').getTime();
  return {
    id: 'test_plan_pause',
    title: 'Subscription to Pause',
    payerAddress: 'G...Payer',
    recipientAddress: 'G...Recipient',
    status: 'active',
    startDate: now,
    currentCycle: 0,
    nextExecutionDate: now,
    lastExecutionDate: null,
    intervalConfig: {
      frequency: 'weekly',
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
  };
}

describe('Pause/Resume Engine', () => {
  describe('pausePlan', () => {
    it('successfully pauses an active plan', () => {
      const plan = createBasePlan();
      const pauseTime = plan.startDate + 2 * MS_PER_DAY;

      const res = pausePlan(plan, pauseTime, 'Vacation pause');
      expect(res.success).toBe(true);
      expect(res.plan.status).toBe('paused');
      expect(res.plan.pausedAt).toBe(pauseTime);
      expect(res.plan.pauseHistory).toHaveLength(1);
      expect(res.plan.pauseHistory[0].pausedAt).toBe(pauseTime);
      expect(res.plan.pauseHistory[0].resumedAt).toBeNull();
      expect(res.plan.pauseHistory[0].reason).toBe('Vacation pause');
      expect(isPlanPaused(res.plan)).toBe(true);
    });

    it('rejects pausing a plan that is already paused', () => {
      const plan = createBasePlan();
      const paused = pausePlan(plan).plan;
      const res = pausePlan(paused);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot pause plan with status 'paused'");
    });

    it('rejects pausing a completed or cancelled plan', () => {
      const plan = createBasePlan();
      plan.status = 'completed';
      expect(pausePlan(plan).success).toBe(false);

      plan.status = 'cancelled';
      expect(pausePlan(plan).success).toBe(false);
    });
  });

  describe('resumePlan', () => {
    it('successfully resumes a paused plan and closes pauseHistory record', () => {
      const plan = createBasePlan();
      const pauseTime = plan.startDate + 2 * MS_PER_DAY;
      const resumeTime = pauseTime + 5 * MS_PER_DAY;

      const paused = pausePlan(plan, pauseTime).plan;
      const resumed = resumePlan(paused, resumeTime, 'catch_up').plan;

      expect(resumed.status).toBe('active');
      expect(resumed.pausedAt).toBeNull();
      expect(resumed.pauseHistory[0].resumedAt).toBe(resumeTime);
      expect(isPlanPaused(resumed)).toBe(false);
    });

    it('handles catch_up policy by allowing due payments during pause to be processed', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan();
      plan.startDate = start;
      plan.nextExecutionDate = start;

      // Plan paused on Jan 2, resumed on Jan 16 (2 weeks later)
      const pauseTime = start + 1 * MS_PER_DAY;
      const resumeTime = start + 15 * MS_PER_DAY;

      const paused = pausePlan(plan, pauseTime).plan;
      const resumed = resumePlan(paused, resumeTime, 'catch_up').plan;

      // With catch_up policy, payments that were due during the pause are ready for execution
      const due = getDueExecutions(resumed, resumeTime);
      // Jan 1 (cycle 1), Jan 8 (cycle 2), Jan 15 (cycle 3) are all due
      expect(due.length).toBeGreaterThanOrEqual(3);
    });

    it('handles shift_schedule policy by shifting future dates forward by pause duration', () => {
      const start = new Date('2025-01-01T00:00:00Z').getTime();
      const plan = createBasePlan();
      plan.startDate = start;
      plan.nextExecutionDate = start + 7 * MS_PER_DAY;

      const pauseTime = start + 2 * MS_PER_DAY;
      const resumeTime = pauseTime + 10 * MS_PER_DAY; // paused for 10 days
      const pauseDuration = 10 * MS_PER_DAY;

      const paused = pausePlan(plan, pauseTime).plan;
      const resumed = resumePlan(paused, resumeTime, 'shift_schedule').plan;

      expect(resumed.startDate).toBe(start + pauseDuration);
      expect(resumed.nextExecutionDate).toBe(plan.nextExecutionDate + pauseDuration);
    });

    it('handles next_scheduled_date policy by resetting next run to 1 interval from resume', () => {
      const plan = createBasePlan();
      const resumeTime = Date.now();

      const paused = pausePlan(plan).plan;
      const resumed = resumePlan(paused, resumeTime, 'next_scheduled_date').plan;

      // Weekly plan -> next run is exactly 7 days from resumeTime
      expect(resumed.nextExecutionDate).toBe(resumeTime + 7 * MS_PER_DAY);
    });

    it('rejects resuming a plan that is not paused', () => {
      const plan = createBasePlan();
      const res = resumePlan(plan);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot resume plan with status 'active'");
    });
  });

  describe('calculateTotalPausedDuration', () => {
    it('sums paused durations across multiple pause and resume sessions', () => {
      const plan = createBasePlan();
      const session1Start = 1000;
      const session1End = 3000; // 2000 ms
      const session2Start = 5000;
      const session2End = 8000; // 3000 ms

      plan.pauseHistory = [
        { id: '1', pausedAt: session1Start, resumedAt: session1End },
        { id: '2', pausedAt: session2Start, resumedAt: session2End },
      ];

      expect(calculateTotalPausedDuration(plan)).toBe(5000);
    });

    it('handles an ongoing pause session using currentTime', () => {
      const plan = createBasePlan();
      plan.pauseHistory = [
        { id: '1', pausedAt: 1000, resumedAt: 2000 }, // 1000 ms
        { id: '2', pausedAt: 3000, resumedAt: null }, // ongoing from 3000
      ];

      expect(calculateTotalPausedDuration(plan, 6000)).toBe(4000); // 1000 + 3000
    });
  });
});
