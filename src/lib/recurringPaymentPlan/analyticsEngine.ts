import type {
  RecurringPaymentPlan,
  SinglePlanAnalytics,
  PortfolioAnalytics,
} from '@/types/recurringPaymentPlan';
import { roundAmount, calculateCycleAmount, projectTotalAmount } from './amountEngine';
import { calculateTotalPausedDuration } from './pauseResumeEngine';
import { getDueExecutions, generateUpcomingSchedule } from './scheduleEngine';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ON_TIME_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 24 hours allowable window

/**
 * Calculates comprehensive analytics for an individual recurring payment plan.
 */
export function calculatePlanAnalytics(
  plan: RecurringPaymentPlan,
  currentTime: number = Date.now()
): SinglePlanAnalytics {
  const completedExecutions = plan.executions.filter((e) => e.status === 'completed');
  const failedExecutions = plan.executions.filter((e) => e.status === 'failed');

  const totalAmountPaid = roundAmount(
    completedExecutions.reduce((sum, e) => sum + e.amount, 0)
  );

  const completedCycles = completedExecutions.length;
  const totalCyclesPlanned = plan.maxCycles ?? null;
  const remainingCycles =
    totalCyclesPlanned !== null ? Math.max(0, totalCyclesPlanned - completedCycles) : null;

  // Calculate remaining projected amount
  let remainingProjectedAmount = 0;
  if (remainingCycles !== null && remainingCycles > 0) {
    remainingProjectedAmount = projectTotalAmount(
      plan.amountConfig,
      completedCycles + 1,
      totalCyclesPlanned!
    );
  } else if (plan.endDate && plan.status === 'active') {
    const upcoming = generateUpcomingSchedule(plan, 50, plan.endDate);
    remainingProjectedAmount = roundAmount(upcoming.reduce((acc, u) => acc + u.amount, 0));
  } else if (plan.status === 'active') {
    // Forecast next 12 cycles if open-ended
    const upcoming = generateUpcomingSchedule(plan, 12);
    remainingProjectedAmount = roundAmount(upcoming.reduce((acc, u) => acc + u.amount, 0));
  }

  // Payment amount stats
  let averagePaymentAmount = plan.amountConfig.baseAmount;
  let minPaymentAmount = plan.amountConfig.baseAmount;
  let maxPaymentAmount = plan.amountConfig.baseAmount;
  let amountVolatility = 0;

  if (completedCycles > 0) {
    averagePaymentAmount = roundAmount(totalAmountPaid / completedCycles);
    minPaymentAmount = Math.min(...completedExecutions.map((e) => e.amount));
    maxPaymentAmount = Math.max(...completedExecutions.map((e) => e.amount));

    // Standard deviation
    const variance =
      completedExecutions.reduce((acc, e) => acc + Math.pow(e.amount - averagePaymentAmount, 2), 0) /
      completedCycles;
    amountVolatility = roundAmount(Math.sqrt(variance));
  }

  // On-time execution tracking
  let onTimeExecutionRate = 100;
  if (completedExecutions.length > 0) {
    const onTimeCount = completedExecutions.filter(
      (e) => Math.abs(e.executedDate - e.scheduledDate) <= ON_TIME_TOLERANCE_MS
    ).length;
    onTimeExecutionRate = roundAmount((onTimeCount / completedExecutions.length) * 100, 2);
  }

  // Overdue / missed payments
  const due = getDueExecutions(plan, currentTime);
  const missedPaymentsCount = due.filter((d) => d.isOverdue).length;

  // Paused metrics
  const timesPaused = plan.pauseHistory.length;
  const totalPausedDurationMs = calculateTotalPausedDuration(plan, currentTime);

  // Lifetime
  const lifetimeDays = Math.max(0, roundAmount((currentTime - plan.createdAt) / MS_PER_DAY, 1));

  // Completion percentage
  let completionPercentage = 0;
  if (totalCyclesPlanned !== null && totalCyclesPlanned > 0) {
    completionPercentage = roundAmount(Math.min(100, (completedCycles / totalCyclesPlanned) * 100), 1);
  } else if (plan.status === 'completed') {
    completionPercentage = 100;
  }

  return {
    planId: plan.id,
    title: plan.title,
    status: plan.status,
    totalCyclesPlanned,
    completedCycles,
    remainingCycles,
    totalAmountPaid,
    remainingProjectedAmount,
    averagePaymentAmount,
    minPaymentAmount,
    maxPaymentAmount,
    amountVolatility,
    onTimeExecutionRate,
    missedPaymentsCount,
    failedPaymentsCount: failedExecutions.length,
    timesPaused,
    totalPausedDurationMs,
    lifetimeDays,
    modificationsCount: plan.modifications.length,
    completionPercentage,
  };
}

/**
 * Calculates portfolio-wide analytics across multiple recurring payment plans.
 */
export function calculatePortfolioAnalytics(
  plans: RecurringPaymentPlan[],
  options?: { currentTime?: number; forecastHorizonDays?: number }
): PortfolioAnalytics {
  const currentTime = options?.currentTime ?? Date.now();
  const forecastHorizonDays = options?.forecastHorizonDays ?? 30;
  const horizonTimestamp = currentTime + forecastHorizonDays * MS_PER_DAY;

  const totalPlans = plans.length;
  let activePlans = 0;
  let pausedPlans = 0;
  let completedPlans = 0;
  let cancelledPlans = 0;

  let totalVolumeCollected = 0;
  let totalProjectedVolume = 0;
  let totalExecutionsCount = 0;
  let successfulExecutionsCount = 0;
  let totalMissedPayments = 0;
  let totalOnTimeRateSum = 0;
  let plansWithExecutions = 0;

  const volumeByCurrency: Record<string, { collected: number; projected: number }> = {};
  const upcomingCashflow: PortfolioAnalytics['upcomingCashflow'] = [];

  for (const plan of plans) {
    if (plan.status === 'active') activePlans++;
    else if (plan.status === 'paused') pausedPlans++;
    else if (plan.status === 'completed') completedPlans++;
    else if (plan.status === 'cancelled') cancelledPlans++;

    const planAnalytics = calculatePlanAnalytics(plan, currentTime);

    totalVolumeCollected += planAnalytics.totalAmountPaid;
    totalProjectedVolume += planAnalytics.remainingProjectedAmount;
    totalMissedPayments += planAnalytics.missedPaymentsCount;

    const completedExecs = plan.executions.filter((e) => e.status === 'completed').length;
    totalExecutionsCount += plan.executions.length;
    successfulExecutionsCount += completedExecs;

    if (plan.executions.length > 0) {
      totalOnTimeRateSum += planAnalytics.onTimeExecutionRate;
      plansWithExecutions++;
    }

    const cur = plan.amountConfig.currency;
    if (!volumeByCurrency[cur]) {
      volumeByCurrency[cur] = { collected: 0, projected: 0 };
    }
    volumeByCurrency[cur].collected = roundAmount(
      volumeByCurrency[cur].collected + planAnalytics.totalAmountPaid
    );
    volumeByCurrency[cur].projected = roundAmount(
      volumeByCurrency[cur].projected + planAnalytics.remainingProjectedAmount
    );

    if (plan.status === 'active') {
      const upcoming = generateUpcomingSchedule(plan, 10, horizonTimestamp);
      for (const item of upcoming) {
        upcomingCashflow.push({
          date: item.scheduledDate,
          amount: item.amount,
          currency: item.currency,
          planId: plan.id,
          planTitle: plan.title,
        });
      }
    }
  }

  // Sort upcoming cashflow chronologically
  upcomingCashflow.sort((a, b) => a.date - b.date);

  const overallOnTimeRate =
    plansWithExecutions > 0 ? roundAmount(totalOnTimeRateSum / plansWithExecutions, 2) : 100;

  const averagePlanSize =
    totalPlans > 0
      ? roundAmount((totalVolumeCollected + totalProjectedVolume) / totalPlans)
      : 0;

  const pauseRate = totalPlans > 0 ? roundAmount((pausedPlans / totalPlans) * 100, 1) : 0;
  const completionRate =
    totalPlans > 0 ? roundAmount((completedPlans / totalPlans) * 100, 1) : 0;
  const churnRate = totalPlans > 0 ? roundAmount((cancelledPlans / totalPlans) * 100, 1) : 0;

  return {
    totalPlans,
    activePlans,
    pausedPlans,
    completedPlans,
    cancelledPlans,
    totalVolumeCollected: roundAmount(totalVolumeCollected),
    totalProjectedVolume: roundAmount(totalProjectedVolume),
    averagePlanSize,
    totalExecutionsCount,
    successfulExecutionsCount,
    overallOnTimeRate,
    totalMissedPayments,
    pauseRate,
    completionRate,
    churnRate,
    volumeByCurrency,
    upcomingCashflow,
  };
}
