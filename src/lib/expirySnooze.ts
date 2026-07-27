/**
 * Expiry Snooze Utility
 *
 * Manages snooze state for invoice expiry countdowns using localStorage.
 * Allows users to suppress banner without changing actual due date.
 */

const SNOOZE_STORAGE_KEY = "invoice_snooze";

export type SnoozeOption = "1h" | "4h" | "until-tomorrow";

export interface SnoozeState {
  invoiceId: string;
  snoozedUntil: number; // timestamp
  option: SnoozeOption;
}

/**
 * Get snooze state for an invoice
 */
export function getSnoozeState(invoiceId: string): SnoozeState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!stored) return null;

    const states: Record<string, SnoozeState> = JSON.parse(stored);
    const state = states[invoiceId];

    if (state && state.snoozedUntil > Date.now()) {
      return state;
    }

    // Snooze expired
    if (state) {
      delete states[invoiceId];
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(states));
    }

    return null;
  } catch (e) {
    console.error("Failed to parse snooze state:", e);
    return null;
  }
}

/**
 * Set snooze for an invoice
 */
export function snoozeInvoice(
  invoiceId: string,
  option: SnoozeOption,
): SnoozeState {
  const now = Date.now();
  let snoozedUntil: number;

  switch (option) {
    case "1h":
      snoozedUntil = now + 60 * 60 * 1000;
      break;
    case "4h":
      snoozedUntil = now + 4 * 60 * 60 * 1000;
      break;
    case "until-tomorrow":
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      snoozedUntil = tomorrow.getTime();
      break;
  }

  const state: SnoozeState = {
    invoiceId,
    snoozedUntil,
    option,
  };

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    const states: Record<string, SnoozeState> = stored
      ? JSON.parse(stored)
      : {};
    states[invoiceId] = state;
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(states));
  }

  return state;
}

/**
 * Clear snooze for an invoice (e.g., when payment is made)
 */
export function clearSnooze(invoiceId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!stored) return;

    const states: Record<string, SnoozeState> = JSON.parse(stored);
    delete states[invoiceId];
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(states));
  } catch (e) {
    console.error("Failed to clear snooze:", e);
  }
}

/**
 * Check if invoice countdown should be shown
 */
export function shouldShowCountdown(invoiceId: string): boolean {
  return !getSnoozeState(invoiceId);
}

/**
 * Format time difference in human-readable format
 * Returns: { days: number, hours: number, minutes: number }
 */
export function getTimeRemaining(dueDate: Date): {
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
} {
  const now = Date.now();
  const dueDateMs = dueDate.getTime();
  const diff = dueDateMs - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isOverdue: true,
    };
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    days,
    hours,
    minutes,
    isOverdue: false,
  };
}

/**
 * Format overdue duration
 */
export function getOverdueDuration(dueDate: Date): {
  days: number;
  hours: number;
  minutes: number;
} {
  const now = Date.now();
  const dueDateMs = dueDate.getTime();
  const diff = now - dueDateMs;

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes };
}
