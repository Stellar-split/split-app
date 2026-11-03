export function getDueSchedules(): any[] {
  return [];
}

export function getScheduleHistory(id: string): any[] {
  return [];
}

export function recordPaymentAttempt(id: string, success: boolean): void {}

export function computeNextRun(schedule: any): number {
  return 0;
}

export function pauseSchedule(id: string): void {}

export function resumeSchedule(id: string): void {}

export function cancelSchedule(id: string): void {}
