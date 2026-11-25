import type {
  RecurringPaymentPlan,
  PlanPauseRecord,
  ResumeSchedulePolicy,
} from '@/types/recurringPaymentPlan';
import { addIntervalToDate, calculateScheduledDateForCycle } from './scheduleEngine';

/**
 * Pauses an active recurring payment plan.
 */
export function pausePlan(
  plan: RecurringPaymentPlan,
  pauseTimestamp: number = Date.now(),
  reason?: string
): {
  success: boolean;
  plan: RecurringPaymentPlan;
  error?: string;
} {
  if (plan.status !== 'active') {
    return {
      success: false,
      plan,
      error: `Cannot pause plan with status '${plan.status}' (must be 'active')`,
    };
  }

  const pauseRecord: PlanPauseRecord = {
    id: `pause_${plan.id}_${pauseTimestamp}`,
    pausedAt: pauseTimestamp,
    resumedAt: null,
    reason,
  };

  const updatedPlan: RecurringPaymentPlan = {
    ...plan,
    status: 'paused',
    pausedAt: pauseTimestamp,
    pauseHistory: [...plan.pauseHistory, pauseRecord],
    updatedAt: pauseTimestamp,
    modifications: [
      ...plan.modifications,
      {
        id: `mod_pause_${pauseTimestamp}`,
        timestamp: pauseTimestamp,
        field: 'status',
        oldValue: 'active',
        newValue: 'paused',
        effectiveFromCycle: plan.currentCycle + 1,
        reason: reason || 'Plan paused',
      },
    ],
  };

  return {
    success: true,
    plan: updatedPlan,
  };
}

/**
 * Resumes a paused recurring payment plan according to a specified schedule policy.
 */
export function resumePlan(
  plan: RecurringPaymentPlan,
  resumeTimestamp: number = Date.now(),
  policy: ResumeSchedulePolicy = 'catch_up'
): {
  success: boolean;
  plan: RecurringPaymentPlan;
  error?: string;
} {
  if (plan.status !== 'paused') {
    return {
      success: false,
      plan,
      error: `Cannot resume plan with status '${plan.status}' (must be 'paused')`,
    };
  }

  const pausedAt = plan.pausedAt ?? resumeTimestamp;
  const pauseDuration = Math.max(0, resumeTimestamp - pausedAt);

  // Close the latest open pause record
  const updatedPauseHistory = plan.pauseHistory.map((record) => {
    if (record.resumedAt === null || record.resumedAt === undefined) {
      return { ...record, resumedAt: resumeTimestamp };
    }
    return record;
  });

  let nextExecutionDate = plan.nextExecutionDate;
  let updatedStartDate = plan.startDate;
  let updatedEndDate = plan.endDate;

  switch (policy) {
    case 'catch_up':
      // Preserve the calendar schedule so that any payments that fell due during the pause
      // are detected and caught up immediately (fulfills "No missed payments").
      if (!nextExecutionDate || nextExecutionDate < resumeTimestamp) {
        // Next due cycle
        nextExecutionDate = calculateScheduledDateForCycle(plan, plan.currentCycle + 1);
      }
      break;

    case 'shift_schedule':
      // Shifts all upcoming schedule milestones forward by the exact pause duration.
      updatedStartDate = plan.startDate + pauseDuration;
      if (updatedEndDate) {
        updatedEndDate = updatedEndDate + pauseDuration;
      }
      if (nextExecutionDate) {
        nextExecutionDate = nextExecutionDate + pauseDuration;
      } else {
        nextExecutionDate = calculateScheduledDateForCycle(
          { startDate: updatedStartDate, intervalConfig: plan.intervalConfig },
          plan.currentCycle + 1
        );
      }
      break;

    case 'next_scheduled_date':
      // Sets next execution to 1 full interval from now
      nextExecutionDate = addIntervalToDate(resumeTimestamp, plan.intervalConfig, 1);
      break;
  }

  const updatedPlan: RecurringPaymentPlan = {
    ...plan,
    status: 'active',
    pausedAt: null,
    startDate: updatedStartDate,
    endDate: updatedEndDate,
    nextExecutionDate,
    pauseHistory: updatedPauseHistory,
    updatedAt: resumeTimestamp,
    modifications: [
      ...plan.modifications,
      {
        id: `mod_resume_${resumeTimestamp}`,
        timestamp: resumeTimestamp,
        field: 'status',
        oldValue: 'paused',
        newValue: 'active',
        effectiveFromCycle: plan.currentCycle + 1,
        reason: `Plan resumed with policy: ${policy}`,
      },
    ],
  };

  return {
    success: true,
    plan: updatedPlan,
  };
}

/**
 * Checks whether a plan is currently in a paused state.
 */
export function isPlanPaused(plan: RecurringPaymentPlan): boolean {
  return plan.status === 'paused';
}

/**
 * Computes total time spent paused in milliseconds across all pause sessions.
 */
export function calculateTotalPausedDuration(
  plan: RecurringPaymentPlan,
  currentTimestamp: number = Date.now()
): number {
  return plan.pauseHistory.reduce((total, session) => {
    const end = session.resumedAt ?? currentTimestamp;
    return total + Math.max(0, end - session.pausedAt);
  }, 0);
}
