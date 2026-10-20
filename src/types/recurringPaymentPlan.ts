export type PlanFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

export type PlanIntervalUnit = 'days' | 'weeks' | 'months' | 'years';

export interface PlanIntervalConfig {
  frequency: PlanFrequency;
  intervalCount: number; // e.g. 1 (every 1 unit), 2 (every 2 units), etc.
  unit?: PlanIntervalUnit;
  customIntervalDays?: number; // Used when frequency is 'custom'
  dayOfMonth?: number; // Optional anchor day of month (1-31)
  dayOfWeek?: number; // Optional anchor day of week (0-6, 0=Sunday)
}

export type AmountVariationType =
  | 'fixed'
  | 'scheduled'
  | 'tiered'
  | 'percentage_step'
  | 'milestone';

export interface PlanScheduledAmount {
  cycle: number; // 1-based cycle index
  amount: number;
  label?: string;
}

export interface PlanAmountTier {
  upToCycle: number; // Applies for cycles <= upToCycle
  amount: number;
}

export interface PlanPercentageStep {
  percentageChange: number; // e.g. 5 for +5%, -10 for -10%
  stepFrequencyCycles: number; // Change applies every N cycles (e.g. every 3 cycles)
  compound?: boolean; // Default true (compound percentage)
  minAmount?: number;
  maxAmount?: number;
}

export interface PlanMilestoneAmount {
  cycle: number;
  amount: number;
  description?: string;
}

export interface PlanAmountConfig {
  type: AmountVariationType;
  baseAmount: number;
  currency: string; // e.g. 'XLM' | 'USDC'
  scheduledAmounts?: PlanScheduledAmount[];
  tieredAmounts?: PlanAmountTier[];
  percentageStep?: PlanPercentageStep;
  milestoneAmounts?: PlanMilestoneAmount[];
  minimumAmount?: number;
  maximumAmount?: number;
}

export type PlanStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface PlanRecipient {
  address: string;
  sharePercentage?: number; // 0-100
  fixedAmount?: number;
}

export interface PlanPauseRecord {
  id: string;
  pausedAt: number; // Unix ms
  resumedAt?: number | null; // Unix ms
  reason?: string;
}

export interface PlanModificationRecord {
  id: string;
  timestamp: number; // Unix ms
  field: string;
  oldValue: unknown;
  newValue: unknown;
  effectiveFromCycle: number;
  reason?: string;
}

export interface PlanExecutionRecord {
  id: string;
  cycle: number;
  scheduledDate: number; // Unix ms
  executedDate: number; // Unix ms
  amount: number;
  currency: string;
  status: 'completed' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
  note?: string;
}

export interface RecurringPaymentPlan {
  id: string;
  title: string;
  description?: string;
  payerAddress: string;
  recipientAddress: string;
  recipients?: PlanRecipient[];
  status: PlanStatus;
  intervalConfig: PlanIntervalConfig;
  amountConfig: PlanAmountConfig;
  startDate: number; // Unix ms
  endDate?: number | null; // Unix ms
  maxCycles?: number | null;
  currentCycle: number; // 0 initially, increments on each execution
  nextExecutionDate: number | null; // Unix ms
  lastExecutionDate: number | null; // Unix ms
  pausedAt?: number | null; // Unix ms
  executions: PlanExecutionRecord[];
  modifications: PlanModificationRecord[];
  pauseHistory: PlanPauseRecord[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ScheduledPaymentItem {
  cycle: number;
  scheduledDate: number; // Unix ms
  amount: number;
  currency: string;
  status: 'completed' | 'due' | 'upcoming';
}

export interface DueExecution {
  cycle: number;
  scheduledDate: number; // Unix ms
  amount: number;
  currency: string;
  isOverdue: boolean;
}

export type ResumeSchedulePolicy =
  | 'catch_up'
  | 'shift_schedule'
  | 'next_scheduled_date';

export interface SinglePlanAnalytics {
  planId: string;
  title: string;
  status: PlanStatus;
  totalCyclesPlanned: number | null;
  completedCycles: number;
  remainingCycles: number | null;
  totalAmountPaid: number;
  remainingProjectedAmount: number;
  averagePaymentAmount: number;
  minPaymentAmount: number;
  maxPaymentAmount: number;
  amountVolatility: number;
  onTimeExecutionRate: number; // 0 - 100 percentage
  missedPaymentsCount: number;
  failedPaymentsCount: number;
  timesPaused: number;
  totalPausedDurationMs: number;
  lifetimeDays: number;
  modificationsCount: number;
  completionPercentage: number;
}

export interface PortfolioAnalytics {
  totalPlans: number;
  activePlans: number;
  pausedPlans: number;
  completedPlans: number;
  cancelledPlans: number;
  totalVolumeCollected: number;
  totalProjectedVolume: number;
  averagePlanSize: number;
  totalExecutionsCount: number;
  successfulExecutionsCount: number;
  overallOnTimeRate: number;
  totalMissedPayments: number;
  pauseRate: number; // 0 - 100 percentage
  completionRate: number; // 0 - 100 percentage
  churnRate: number; // 0 - 100 percentage
  volumeByCurrency: Record<string, { collected: number; projected: number }>;
  upcomingCashflow: Array<{
    date: number;
    amount: number;
    currency: string;
    planId: string;
    planTitle: string;
  }>;
}

export interface PlanModificationInput {
  title?: string;
  description?: string;
  recipients?: PlanRecipient[];
  intervalConfig?: Partial<PlanIntervalConfig>;
  amountConfig?: Partial<PlanAmountConfig>;
  endDate?: number | null;
  maxCycles?: number | null;
}
