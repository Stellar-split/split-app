/**
 * Reminder system — stores invoice reminders in localStorage and fires
 * browser Notification API alerts when the reminder time is reached.
 */

export interface Reminder {
  invoiceId: string;
  reminderDate: string; // ISO 8601
  message: string;
}

const STORAGE_KEY = "stellarsplit_reminders";

export function getReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Reminder[];
  } catch {
    return [];
  }
}

export function setReminder(reminder: Reminder): void {
  const reminders = getReminders().filter((r) => r.invoiceId !== reminder.invoiceId);
  reminders.push(reminder);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function cancelReminder(invoiceId: string): void {
  const reminders = getReminders().filter((r) => r.invoiceId !== invoiceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function getReminderForInvoice(invoiceId: string): Reminder | undefined {
  return getReminders().find((r) => r.invoiceId === invoiceId);
}

export interface BulkReminderResult {
  invoiceId: string;
  success: boolean;
  error?: string;
}

export function setBulkReminders(
  invoiceIds: string[],
  reminderDate: string,
  message?: string
): BulkReminderResult[] {
  return invoiceIds.map((invoiceId) => {
    try {
      setReminder({
        invoiceId,
        reminderDate,
        message: message ?? `Invoice #${invoiceId} payment reminder`,
      });
      return { invoiceId, success: true };
    } catch (err) {
      return { invoiceId, success: false, error: String(err) };
    }
  });
}

/**
 * Check all stored reminders and fire browser notifications for any that are
 * past-due. Called once on app load from layout.tsx.
 */
export async function checkAndFireReminders(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  const now = new Date();
  const reminders = getReminders();
  const fired: string[] = [];

  for (const reminder of reminders) {
    if (new Date(reminder.reminderDate) <= now) {
      if (Notification.permission === "granted") {
        new Notification(`StellarSplit Reminder — Invoice #${reminder.invoiceId}`, {
          body: reminder.message,
          icon: "/favicon.ico",
        });
        fired.push(reminder.invoiceId);
      } else if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(`StellarSplit Reminder — Invoice #${reminder.invoiceId}`, {
            body: reminder.message,
            icon: "/favicon.ico",
          });
          fired.push(reminder.invoiceId);
        }
      }
    }
  }

  // Remove fired reminders
  if (fired.length > 0) {
    const remaining = reminders.filter((r) => !fired.includes(r.invoiceId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  }
}
