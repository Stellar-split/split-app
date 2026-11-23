export interface RecurringSchedule {
  id: string;
  invoiceId: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextRun: string;
  lastRun?: string;
  status: 'active' | 'paused' | 'cancelled';
  totalAmount: number;
  amountPerRun: number;
  amount: number;
  token?: string;
  templateName?: string;
}

export interface ScheduleHistoryEntry {
  id: string;
  scheduleId: string;
  timestamp: number;
  success: boolean;
  status: 'success' | 'failed';
  amount: number;
  txHash?: string;
}

export function getDueSchedules(invoiceId?: string): RecurringSchedule[] {
  return [];
}

export function getScheduleHistory(invoiceId: string): ScheduleHistoryEntry[] {
  return [];
}

export interface PaymentAttemptRecord {
  status: 'success' | 'failed';
  amount: number;
  nextRun: string | number;
  note: string;
}

export function recordPaymentAttempt(id: string, record: PaymentAttemptRecord): void {}

export function computeNextRun(schedule: RecurringSchedule): string {
  return new Date().toISOString().split('T')[0];
}

export function pauseSchedule(id: string): void {}

export function resumeSchedule(id: string): void {}

export function cancelSchedule(id: string): void {}
