import type { Reminder } from './reminders';

const SUPPRESSED_REMINDERS_KEY = 'suppressed_reminders';
const REMINDER_EVENTS_KEY = 'reminder_events';

export async function dispatchReminder(reminder: Reminder): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      new Notification(`Invoice #${reminder.invoiceId}`, {
        body: reminder.message,
        icon: '/icon.png',
        tag: `reminder-${reminder.invoiceId}`,
      });
      return true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(`Invoice #${reminder.invoiceId}`, {
          body: reminder.message,
          icon: '/icon.png',
          tag: `reminder-${reminder.invoiceId}`,
        });
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to dispatch reminder:', error);
  }
  return false;
}

export function isReminderSuppressed(invoiceId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const suppressed = JSON.parse(localStorage.getItem(SUPPRESSED_REMINDERS_KEY) || '{}');
    return suppressed[invoiceId] === true;
  } catch {
    return false;
  }
}

export function suppressReminder(invoiceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const suppressed = JSON.parse(localStorage.getItem(SUPPRESSED_REMINDERS_KEY) || '{}');
    suppressed[invoiceId] = true;
    localStorage.setItem(SUPPRESSED_REMINDERS_KEY, JSON.stringify(suppressed));
  } catch (error) {
    console.error('Failed to suppress reminder:', error);
  }
}

export interface ReminderEvent {
  invoiceId: string;
  event: 'sent' | 'opened' | 'snoozed';
  timestamp: string;
}

export function recordReminderEvent(invoiceId: string, event: 'sent' | 'opened' | 'snoozed'): void {
  if (typeof window === 'undefined') return;
  try {
    const events: ReminderEvent[] = JSON.parse(localStorage.getItem(REMINDER_EVENTS_KEY) || '[]');
    events.push({
      invoiceId,
      event,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(REMINDER_EVENTS_KEY, JSON.stringify(events.slice(-100)));
  } catch (error) {
    console.error('Failed to record reminder event:', error);
  }
}

export function getReminderEvents(invoiceId: string): ReminderEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const events: ReminderEvent[] = JSON.parse(localStorage.getItem(REMINDER_EVENTS_KEY) || '[]');
    return events.filter(e => e.invoiceId === invoiceId);
  } catch {
    return [];
  }
}
