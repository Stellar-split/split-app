import type {
  RecurringPaymentPlan,
  PlanIntervalConfig,
  DueExecution,
  PlanExecutionRecord,
  ScheduledPaymentItem,
} from '@/types/recurringPaymentPlan';
import { calculateCycleAmount } from './amountEngine';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Safely adds an interval to a base date timestamp.
 * Correctly accounts for days, weeks, months (with month-end clamping), and years.
 */
export function addIntervalToDate(
  baseTimestamp: number,
  config: PlanIntervalConfig,
  stepCount: number = 1
): number {
  if (stepCount === 0) return baseTimestamp;

  const date = new Date(baseTimestamp);

  switch (config.frequency) {
    case 'daily':
      return baseTimestamp + stepCount * (config.intervalCount || 1) * MS_PER_DAY;

    case 'weekly':
      return baseTimestamp + stepCount * (config.intervalCount || 1) * 7 * MS_PER_DAY;

    case 'biweekly':
      return baseTimestamp + stepCount * (config.intervalCount || 1) * 14 * MS_PER_DAY;

    case 'monthly': {
      const intervalMonths = stepCount * (config.intervalCount || 1);
      const originalDay = config.dayOfMonth ?? date.getDate();
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth() + intervalMonths;

      const newDate = new Date(targetYear, targetMonth, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
      // Clamping: ensure day doesn't roll into next month (e.g. Jan 31 -> Feb 28)
      const daysInTargetMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, daysInTargetMonth);
      newDate.setDate(clampedDay);
      return newDate.getTime();
    }

    case 'quarterly': {
      const intervalMonths = stepCount * (config.intervalCount || 1) * 3;
      const originalDay = config.dayOfMonth ?? date.getDate();
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth() + intervalMonths;

      const newDate = new Date(targetYear, targetMonth, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
      const daysInTargetMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, daysInTargetMonth);
      newDate.setDate(clampedDay);
      return newDate.getTime();
    }

    case 'yearly': {
      const intervalYears = stepCount * (config.intervalCount || 1);
      const originalDay = config.dayOfMonth ?? date.getDate();
      const targetYear = date.getFullYear() + intervalYears;
      const targetMonth = date.getMonth();

      const newDate = new Date(targetYear, targetMonth, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
      const daysInTargetMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      const clampedDay = Math.min(originalDay, daysInTargetMonth);
      newDate.setDate(clampedDay);
      return newDate.getTime();
    }

    case 'custom': {
      if (config.customIntervalDays && config.customIntervalDays > 0) {
        return baseTimestamp + stepCount * config.customIntervalDays * MS_PER_DAY;
      }
      const unit = config.unit || 'days';
      const count = (config.intervalCount || 1) * stepCount;
      if (unit === 'days') {
        return baseTimestamp + count * MS_PER_DAY;
      } else if (unit === 'weeks') {
        return baseTimestamp + count * 7 * MS_PER_DAY;
      } else if (unit === 'months') {
        const originalDay = config.dayOfMonth ?? date.getDate();
        const newDate = new Date(date.getFullYear(), date.getMonth() + count, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
        const daysInTargetMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
        newDate.setDate(Math.min(originalDay, daysInTargetMonth));
        return newDate.getTime();
      } else if (unit === 'years') {
        const originalDay = config.dayOfMonth ?? date.getDate();
        const newDate = new Date(date.getFullYear() + count, date.getMonth(), 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
        const daysInTargetMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
        newDate.setDate(Math.min(originalDay, daysInTargetMonth));
        return newDate.getTime();
      }
      return baseTimestamp + count * MS_PER_DAY;
    }

    default:
      return baseTimestamp + stepCount * MS_PER_DAY;
  }
}

/**
 * Calculates the exact scheduled timestamp for a given cycle (1-based index).
 * Cycle 1 is scheduled at startDate.
 * Cycle n is scheduled at startDate + (n - 1) intervals.
 */
export function calculateScheduledDateForCycle(
  plan: Pick<RecurringPaymentPlan, 'startDate' | 'intervalConfig'>,
  cycle: number
): number {
  if (cycle < 1) {
    throw new Error(`Cycle must be >= 1 (got ${cycle})`);
  }
  return addIntervalToDate(plan.startDate, plan.intervalConfig, cycle - 1);
}

/**
 * Evaluates whether a plan has reached its conclusion criteria.
 */
export function isPlanCompleted(
  plan: Pick<RecurringPaymentPlan, 'currentCycle' | 'maxCycles' | 'endDate' | 'nextExecutionDate'>
): boolean {
  if (plan.maxCycles !== null && plan.maxCycles !== undefined && plan.currentCycle >= plan.maxCycles) {
    return true;
  }
  if (plan.endDate !== null && plan.endDate !== undefined) {
    if (plan.nextExecutionDate !== null && plan.nextExecutionDate > plan.endDate) {
      return true;
    }
  }
  return false;
}

/**
 * Identifies all due/overdue executions as of a specific point in time.
 * Essential for the "No missed payments" guarantee.
 */
export function getDueExecutions(
  plan: RecurringPaymentPlan,
  asOfTime: number = Date.now()
): DueExecution[] {
  // If plan is not active (paused, completed, cancelled), no payments should execute right now
  if (plan.status !== 'active') {
    return [];
  }

  const dueList: DueExecution[] = [];
  let nextCycle = plan.currentCycle + 1;

  while (true) {
    if (plan.maxCycles !== null && plan.maxCycles !== undefined && nextCycle > plan.maxCycles) {
      break;
    }

    const scheduledDate = calculateScheduledDateForCycle(plan, nextCycle);

    if (plan.endDate !== null && plan.endDate !== undefined && scheduledDate > plan.endDate) {
      break;
    }

    if (scheduledDate <= asOfTime) {
      const amount = calculateCycleAmount(plan.amountConfig, nextCycle);
      dueList.push({
        cycle: nextCycle,
        scheduledDate,
        amount,
        currency: plan.amountConfig.currency,
        isOverdue: asOfTime - scheduledDate > MS_PER_DAY,
      });
      nextCycle++;
    } else {
      break;
    }
  }

  return dueList;
}

/**
 * Executes a single scheduled payment on the plan.
 * Validates plan state, records execution, updates cycles, and computes next execution date.
 */
export function executePayment(
  plan: RecurringPaymentPlan,
  executionTime: number = Date.now(),
  txDetails?: { txHash?: string; note?: string }
): {
  success: boolean;
  plan: RecurringPaymentPlan;
  execution?: PlanExecutionRecord;
  error?: string;
} {
  if (plan.status !== 'active') {
    return {
      success: false,
      plan,
      error: `Cannot execute payment on a plan with status '${plan.status}'`,
    };
  }

  const nextCycle = plan.currentCycle + 1;

  if (plan.maxCycles !== null && plan.maxCycles !== undefined && nextCycle > plan.maxCycles) {
    return {
      success: false,
      plan: { ...plan, status: 'completed', nextExecutionDate: null },
      error: `Plan has reached its maximum cycles (${plan.maxCycles})`,
    };
  }

  const scheduledDate = calculateScheduledDateForCycle(plan, nextCycle);

  if (plan.endDate !== null && plan.endDate !== undefined && scheduledDate > plan.endDate) {
    return {
      success: false,
      plan: { ...plan, status: 'completed', nextExecutionDate: null },
      error: `Scheduled execution exceeds plan endDate`,
    };
  }

  const amount = calculateCycleAmount(plan.amountConfig, nextCycle);

  const executionRecord: PlanExecutionRecord = {
    id: `exec_${plan.id}_${nextCycle}_${executionTime}`,
    cycle: nextCycle,
    scheduledDate,
    executedDate: executionTime,
    amount,
    currency: plan.amountConfig.currency,
    status: 'completed',
    txHash: txDetails?.txHash || `0x${Math.random().toString(16).substring(2, 10)}`,
    note: txDetails?.note,
  };

  const updatedExecutions = [...plan.executions, executionRecord];
  const subsequentCycle = nextCycle + 1;
  let nextDate: number | null = calculateScheduledDateForCycle(plan, subsequentCycle);
  let status = plan.status;

  if (plan.maxCycles !== null && plan.maxCycles !== undefined && nextCycle >= plan.maxCycles) {
    status = 'completed';
    nextDate = null;
  } else if (plan.endDate !== null && plan.endDate !== undefined && nextDate > plan.endDate) {
    status = 'completed';
    nextDate = null;
  }

  const updatedPlan: RecurringPaymentPlan = {
    ...plan,
    status,
    currentCycle: nextCycle,
    lastExecutionDate: executionTime,
    nextExecutionDate: nextDate,
    executions: updatedExecutions,
    updatedAt: executionTime,
  };

  return {
    success: true,
    plan: updatedPlan,
    execution: executionRecord,
  };
}

/**
 * Processes all due and overdue payments sequentially to guarantee "No missed payments".
 */
export async function catchUpDuePayments(
  plan: RecurringPaymentPlan,
  asOfTime: number = Date.now(),
  executor?: (record: PlanExecutionRecord) => boolean | Promise<boolean>
): Promise<{
  plan: RecurringPaymentPlan;
  executedCount: number;
  errors: string[];
}> {
  let currentPlan = { ...plan };
  let executedCount = 0;
  const errors: string[] = [];

  const dueList = getDueExecutions(currentPlan, asOfTime);

  for (const due of dueList) {
    const result = executePayment(currentPlan, asOfTime);
    if (!result.success || !result.execution) {
      errors.push(result.error || `Failed to execute cycle ${due.cycle}`);
      break;
    }

    if (executor) {
      try {
        const ok = await executor(result.execution);
        if (!ok) {
          errors.push(`External payment executor rejected cycle ${due.cycle}`);
          break;
        }
      } catch (err: any) {
        errors.push(err.message || `External payment execution exception on cycle ${due.cycle}`);
        break;
      }
    }

    currentPlan = result.plan;
    executedCount++;
  }

  return {
    plan: currentPlan,
    executedCount,
    errors,
  };
}

/**
 * Projects upcoming payments for visual schedules, previews, and calendars.
 */
export function generateUpcomingSchedule(
  plan: RecurringPaymentPlan,
  limitCount: number = 10,
  untilDate?: number
): ScheduledPaymentItem[] {
  const items: ScheduledPaymentItem[] = [];
  const startFromCycle = plan.currentCycle + 1;
  let count = 0;

  for (let c = startFromCycle; count < limitCount; c++) {
    if (plan.maxCycles !== null && plan.maxCycles !== undefined && c > plan.maxCycles) {
      break;
    }

    const scheduledDate = calculateScheduledDateForCycle(plan, c);

    if (plan.endDate !== null && plan.endDate !== undefined && scheduledDate > plan.endDate) {
      break;
    }

    if (untilDate && scheduledDate > untilDate) {
      break;
    }

    const amount = calculateCycleAmount(plan.amountConfig, c);
    const now = Date.now();

    items.push({
      cycle: c,
      scheduledDate,
      amount,
      currency: plan.amountConfig.currency,
      status: scheduledDate <= now ? 'due' : 'upcoming',
    });

    count++;
  }

  return items;
}
