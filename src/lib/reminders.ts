/**
 * Reminder system — stores invoice reminders in localStorage and fires
 * browser Notification API alerts when the reminder time is reached.
 *
 * Also provides a scheduling/escalation engine for payment reminders:
 * escalation levels keyed on invoice age, template-based messages,
 * suppression/opt-out, multi-channel dispatch and engagement metrics.
 */

import { sendPaymentReceiptEmail } from "./paymentReceiptEmailer";
import { sendPushNotification } from "./pushNotifications";
import { addNotification } from "./notifications";

export interface Reminder {
  invoiceId: string;
  reminderDate: string; // ISO 8601
  message: string;
}

const STORAGE_KEY = "stellarsplit_reminders";

// ---------------------------------------------------------------------------
// Escalation levels & scheduling
// ---------------------------------------------------------------------------

export type EscalationLevel = "gentle" | "urgent" | "final";

/** Days past the due date at which each escalation level kicks in. */
export const ESCALATION_THRESHOLDS: Record<EscalationLevel, number> = {
  gentle: 0,
  urgent: 7,
  final: 14,
};

/** Days between successive reminders at each escalation level. */
export const REMINDER_INTERVAL_DAYS: Record<EscalationLevel, number> = {
  gentle: 3,
  urgent: 3,
  final: 2,
};

export interface InvoiceLike {
  id: string;
  dueDate: string; // ISO 8601
  amount?: number;
  currency?: string;
  recipientEmail?: string;
  recipientName?: string;
}

export interface ReminderSchedule {
  invoiceId: string;
  level: EscalationLevel;
  /** ISO 8601 date of the next reminder. */
  nextReminderDate: string;
  /** Whole days the invoice is past due (0 if not yet due). */
  daysPastDue: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole days between two dates (b - a), floored. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/** Determine the escalation level for a given number of days past due. */
export function getEscalationLevel(daysPastDue: number): EscalationLevel {
  if (daysPastDue >= ESCALATION_THRESHOLDS.final) return "final";
  if (daysPastDue >= ESCALATION_THRESHOLDS.urgent) return "urgent";
  return "gentle";
}

/**
 * Compute the next reminder date and escalation level for an invoice.
 * `now` is injectable for testing.
 */
export function computeReminderSchedule(
  invoice: InvoiceLike,
  now: Date = new Date()
): ReminderSchedule {
  const due = new Date(invoice.dueDate);
  const daysPastDue = Math.max(0, daysBetween(due, now));
  const level = getEscalationLevel(daysPastDue);

  // Next reminder fires one interval after "now", aligned to the level.
  const next = new Date(now);
  next.setDate(next.getDate() + REMINDER_INTERVAL_DAYS[level]);

  return {
    invoiceId: invoice.id,
    level,
    nextReminderDate: next.toISOString(),
    daysPastDue,
  };
}

// ---------------------------------------------------------------------------
// Template-based messages
// ---------------------------------------------------------------------------

export interface ReminderTemplateContext {
  invoiceId: string;
  amount?: number;
  currency?: string;
  recipientName?: string;
  daysPastDue?: number;
}

const TEMPLATES: Record<EscalationLevel, (ctx: ReminderTemplateContext) => string> = {
  gentle: (ctx) =>
    `Hi${ctx.recipientName ? ` ${ctx.recipientName}` : ""}, this is a friendly reminder that invoice #${ctx.invoiceId}${
      ctx.amount != null ? ` (${formatAmount(ctx.amount, ctx.currency)})` : ""
    } is due. Please let us know if you have any questions.`,
  urgent: (ctx) =>
    `Reminder: invoice #${ctx.invoiceId}${
      ctx.amount != null ? ` (${formatAmount(ctx.amount, ctx.currency)})` : ""
    } is now ${ctx.daysPastDue ?? 0} day(s) past due. Please arrange payment at your earliest convenience.`,
  final: (ctx) =>
    `Final notice: invoice #${ctx.invoiceId}${
      ctx.amount != null ? ` (${formatAmount(ctx.amount, ctx.currency)})` : ""
    } is ${ctx.daysPastDue ?? 0} day(s) overdue. Immediate payment is required to avoid further action.`,
};

function formatAmount(amount: number, currency?: string): string {
  return `${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

/** Render the reminder message for a given escalation level. */
export function renderReminderMessage(
  level: EscalationLevel,
  ctx: ReminderTemplateContext
): string {
  return TEMPLATES[level](ctx);
}

// ---------------------------------------------------------------------------
// Suppression / opt-out
// ---------------------------------------------------------------------------

const SUPPRESSION_KEY = "stellarsplit_reminder_suppressions";

export interface SuppressionRecord {
  invoiceId: string;
  reason?: string;
  suppressedAt: string; // ISO 8601
}

export function getSuppressions(): SuppressionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SUPPRESSION_KEY) ?? "[]") as SuppressionRecord[];
  } catch {
    return [];
  }
}

export function isReminderSuppressed(invoiceId: string): boolean {
  return getSuppressions().some((s) => s.invoiceId === invoiceId);
}

export function suppressReminder(invoiceId: string, reason?: string): void {
  if (typeof window === "undefined") return;
  const records = getSuppressions().filter((s) => s.invoiceId !== invoiceId);
  records.push({ invoiceId, reason, suppressedAt: new Date().toISOString() });
  localStorage.setItem(SUPPRESSION_KEY, JSON.stringify(records));
}

export function unsuppressReminder(invoiceId: string): void {
  if (typeof window === "undefined") return;
  const records = getSuppressions().filter((s) => s.invoiceId !== invoiceId);
  localStorage.setItem(SUPPRESSION_KEY, JSON.stringify(records));
}

// ---------------------------------------------------------------------------
// Channel dispatch
// ---------------------------------------------------------------------------

export type ReminderChannel = "email" | "push" | "inapp";

export interface ReminderDispatchResult {
  invoiceId: string;
  level: EscalationLevel;
  suppressed: boolean;
  channels: Partial<Record<ReminderChannel, boolean>>;
}

export interface DispatchOptions {
  channels?: ReminderChannel[];
  recipientEmail?: string;
  recipientName?: string;
  amount?: number;
  currency?: string;
  daysPastDue?: number;
}

const DEFAULT_CHANNELS: ReminderChannel[] = ["email", "push", "inapp"];

/**
 * Dispatch a reminder across the requested channels. Suppressed invoices are
 * skipped entirely (returns `suppressed: true` with no channels attempted).
 */
export async function dispatchReminder(
  invoiceId: string,
  level: EscalationLevel,
  options: DispatchOptions = {}
): Promise<ReminderDispatchResult> {
  if (isReminderSuppressed(invoiceId)) {
    return { invoiceId, level, suppressed: true, channels: {} };
  }

  const message = renderReminderMessage(level, {
    invoiceId,
    amount: options.amount,
    currency: options.currency,
    recipientName: options.recipientName,
    daysPastDue: options.daysPastDue,
  });

  const channels = options.channels ?? DEFAULT_CHANNELS;
  const results: Partial<Record<ReminderChannel, boolean>> = {};

  for (const channel of channels) {
    try {
      if (channel === "email") {
        if (!options.recipientEmail) {
          results.email = false;
        } else {
          await sendPaymentReceiptEmail({
            to: options.recipientEmail,
            invoiceId,
            subject: `Payment reminder — invoice #${invoiceId}`,
            message,
          });
          results.email = true;
        }
      } else if (channel === "push") {
        await sendPushNotification({
          title: `Payment reminder — invoice #${invoiceId}`,
          body: message,
        });
        results.push = true;
      } else if (channel === "inapp") {
        addNotification({
          type: "reminder",
          title: `Payment reminder — invoice #${invoiceId}`,
          message,
        });
        results.inapp = true;
      }
    } catch {
      results[channel] = false;
    }
  }

  return { invoiceId, level, suppressed: false, channels: results };
}

// ---------------------------------------------------------------------------
// Engagement metrics
// ---------------------------------------------------------------------------

export type ReminderEventType = "sent" | "opened" | "clicked" | "paid";

export interface ReminderEvent {
  invoiceId: string;
  level: EscalationLevel;
  type: ReminderEventType;
  channel?: ReminderChannel;
  timestamp: string; // ISO 8601
}

const EVENTS_KEY = "stellarsplit_reminder_events";

export function getReminderEvents(): ReminderEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]") as ReminderEvent[];
  } catch {
    return [];
  }
}

export function recordReminderEvent(
  event: Omit<ReminderEvent, "timestamp"> & { timestamp?: string }
): void {
  if (typeof window === "undefined") return;
  const events = getReminderEvents();
  events.push({ ...event, timestamp: event.timestamp ?? new Date().toISOString() });
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export interface ReminderMetrics {
  sent: number;
  opened: number;
  clicked: number;
  paid: number;
  /** opened / sent, 0 when no reminders were sent. */
  openRate: number;
  /** clicked / sent, 0 when no reminders were sent. */
  clickRate: number;
  /** paid / sent, 0 when no reminders were sent. */
  paidRate: number;
  byLevel: Record<EscalationLevel, number>;
  byChannel: Partial<Record<ReminderChannel, number>>;
}

/** Aggregate engagement metrics, optionally scoped to a single invoice. */
export function getReminderMetrics(invoiceId?: string): ReminderMetrics {
  const events = getReminderEvents().filter((e) => !invoiceId || e.invoiceId === invoiceId);

  const metrics: ReminderMetrics = {
    sent: 0,
    opened: 0,
    clicked: 0,
    paid: 0,
    openRate: 0,
    clickRate: 0,
    paidRate: 0,
    byLevel: { gentle: 0, urgent: 0, final: 0 },
    byChannel: {},
  };

  for (const event of events) {
    if (event.type === "sent") {
      metrics.sent += 1;
      metrics.byLevel[event.level] += 1;
      if (event.channel) {
        metrics.byChannel[event.channel] = (metrics.byChannel[event.channel] ?? 0) + 1;
      }
    } else if (event.type === "opened") {
      metrics.opened += 1;
    } else if (event.type === "clicked") {
      metrics.clicked += 1;
    } else if (event.type === "paid") {
      metrics.paid += 1;
    }
  }

  if (metrics.sent > 0) {
    metrics.openRate = metrics.opened / metrics.sent;
    metrics.clickRate = metrics.clicked / metrics.sent;
    metrics.paidRate = metrics.paid / metrics.sent;
  }

  return metrics;
}

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
    if (isReminderSuppressed(reminder.invoiceId)) continue;
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
