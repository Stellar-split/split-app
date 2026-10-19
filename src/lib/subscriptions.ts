import { formatAmount } from "@stellar-split/sdk";
import type {
  Subscription,
  SubscriptionFrequency,
  SubscriptionInvoice,
} from "@/types/subscription";

const STORAGE_KEY = "stellar_split_subscriptions";
const SCHEDULE_STORAGE_KEY = "stellar_split_recurring_schedules";

export type RecurringScheduleFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export type RecurringScheduleStatus = "active" | "paused" | "cancelled";

export interface RecurringScheduleHistoryEntry {
  id: string;
  scheduleId: string;
  action: "created" | "updated" | "paused" | "resumed" | "cancelled" | "invoice";
  timestamp: number;
  note?: string;
}

export interface RecurringInvoiceTemplate {
  id: string;
  name: string;
  recipients: Array<{ address: string; amount: bigint }>;
  frequency: RecurringScheduleFrequency;
  /** Interval in days; used directly for "custom", derived for the others. */
  intervalDays: number;
  /** Unix seconds of the first scheduled run. */
  startDate: number;
  /** Optional Unix seconds after which the schedule stops. */
  endDate?: number;
  status: RecurringScheduleStatus;
  nextRunDate: number;
  createdAt: number;
  updatedAt: number;
  history: RecurringScheduleHistoryEntry[];
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ScheduleConflict {
  scheduleId: string;
  name: string;
  date: number;
}

export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 365;

export function frequencyToIntervalDaysForSchedule(
  freq: RecurringScheduleFrequency,
  customIntervalDays?: number
): number {
  switch (freq) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "custom":
      return customIntervalDays ?? 0;
  }
}

export function loadRecurringSchedules(): RecurringInvoiceTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((s) => ({
      ...s,
      recipients: (s.recipients as Array<{ address: string; amount: string }>).map(
        (r) => ({ ...r, amount: BigInt(r.amount) })
      ),
      history: (s.history as RecurringScheduleHistoryEntry[]) ?? [],
    })) as RecurringInvoiceTemplate[];
  } catch {
    return [];
  }
}

export function saveRecurringSchedules(schedules: RecurringInvoiceTemplate[]): void {
  if (typeof window === "undefined") return;
  const serializable = schedules.map((s) => ({
    ...s,
    recipients: s.recipients.map((r) => ({
      ...r,
      amount: r.amount.toString(),
    })),
  }));
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(serializable));
}

export function getRecurringScheduleById(
  id: string
): RecurringInvoiceTemplate | undefined {
  return loadRecurringSchedules().find((s) => s.id === id);
}

function generateScheduleId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateSchedule(
  schedule: Pick<
    RecurringInvoiceTemplate,
    "frequency" | "intervalDays" | "startDate" | "endDate" | "recipients"
  >
): ScheduleValidationResult {
  const errors: string[] = [];

  if (!schedule.recipients || schedule.recipients.length === 0) {
    errors.push("At least one recipient is required.");
  } else {
    for (const r of schedule.recipients) {
      if (!r.address || r.address.trim().length === 0) {
        errors.push("Recipient address cannot be empty.");
      }
      if (r.amount <= BigInt(0)) {
        errors.push("Recipient amount must be greater than zero.");
      }
    }
  }

  if (
    !Number.isFinite(schedule.intervalDays) ||
    schedule.intervalDays < MIN_INTERVAL_DAYS ||
    schedule.intervalDays > MAX_INTERVAL_DAYS
  ) {
    errors.push(
      `Interval must be between ${MIN_INTERVAL_DAYS} and ${MAX_INTERVAL_DAYS} days.`
    );
  }

  if (schedule.frequency === "custom" && schedule.intervalDays <= 0) {
    errors.push("Custom schedules require a positive interval.");
  }

  if (!Number.isFinite(schedule.startDate) || schedule.startDate <= 0) {
    errors.push("Start date must be a valid future date.");
  }

  if (
    schedule.endDate !== undefined &&
    schedule.endDate <= schedule.startDate
  ) {
    errors.push("End date must be after the start date.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compute the next run date (Unix seconds) after `fromDate` for a schedule.
 */
export function computeNextRunDate(
  intervalDays: number,
  fromDate: number = Math.floor(Date.now() / 1000)
): number {
  return fromDate + intervalDays * 86400;
}

/**
 * Detect conflicts: another active schedule with the same recipients that
 * would fire on the same day as any of the proposed schedule's next runs.
 */
export function detectScheduleConflicts(
  candidate: Pick<
    RecurringInvoiceTemplate,
    "id" | "recipients" | "intervalDays" | "startDate" | "endDate"
  >,
  existing: RecurringInvoiceTemplate[] = loadRecurringSchedules(),
  lookaheadCount = 12
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const candidateAddresses = new Set(
    candidate.recipients.map((r) => r.address)
  );
  const candidateDates = computeScheduleRunDates(
    candidate.intervalDays,
    candidate.startDate,
    lookaheadCount,
    candidate.endDate
  ).map((d) => Math.floor(d / 86400));

  for (const other of existing) {
    if (other.id === candidate.id) continue;
    if (other.status !== "active") continue;
    const sharesRecipient = other.recipients.some((r) =>
      candidateAddresses.has(r.address)
    );
    if (!sharesRecipient) continue;

    const otherDates = computeScheduleRunDates(
      other.intervalDays,
      other.nextRunDate,
      lookaheadCount,
      other.endDate
    ).map((d) => Math.floor(d / 86400));

    for (const day of candidateDates) {
      if (otherDates.includes(day)) {
        conflicts.push({
          scheduleId: other.id,
          name: other.name,
          date: day * 86400,
        });
        break;
      }
    }
  }

  return conflicts;
}

/**
 * Compute upcoming run dates (Unix seconds) for a schedule.
 */
export function computeScheduleRunDates(
  intervalDays: number,
  startDate: number,
  count: number,
  endDate?: number
): number[] {
  const dates: number[] = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    if (endDate !== undefined && current > endDate) break;
    dates.push(current);
    current = current + intervalDays * 86400;
  }
  return dates;
}

export function createRecurringSchedule(
  input: Omit<
    RecurringInvoiceTemplate,
    "id" | "status" | "nextRunDate" | "createdAt" | "updatedAt" | "history"
  >
): { schedule?: RecurringInvoiceTemplate; validation: ScheduleValidationResult } {
  const validation = validateSchedule(input);
  if (!validation.valid) return { validation };

  const conflicts = detectScheduleConflicts({
    id: "",
    recipients: input.recipients,
    intervalDays: input.intervalDays,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (conflicts.length > 0) {
    return {
      validation: {
        valid: false,
        errors: conflicts.map(
          (c) =>
            `Conflicts with schedule "${c.name}" on ${new Date(
              c.date * 1000
            ).toLocaleDateString()}.`
        ),
      },
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const schedule: RecurringInvoiceTemplate = {
    ...input,
    id: generateScheduleId(),
    status: "active",
    nextRunDate: input.startDate,
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
        scheduleId: "",
        action: "created",
        timestamp: now,
      },
    ],
  };
  schedule.history[0].scheduleId = schedule.id;

  const all = loadRecurringSchedules();
  all.push(schedule);
  saveRecurringSchedules(all);
  return { schedule, validation: { valid: true, errors: [] } };
}

export function updateRecurringSchedule(
  id: string,
  updates: Partial<
    Omit<
      RecurringInvoiceTemplate,
      "id" | "createdAt" | "history" | "status" | "nextRunDate"
    >
  >
): { schedule?: RecurringInvoiceTemplate; validation: ScheduleValidationResult } {
  const all = loadRecurringSchedules();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) {
    return {
      validation: { valid: false, errors: ["Schedule not found."] },
    };
  }

  const merged = { ...all[index], ...updates };
  const validation = validateSchedule(merged);
  if (!validation.valid) return { validation };

  const conflicts = detectScheduleConflicts(
    {
      id,
      recipients: merged.recipients,
      intervalDays: merged.intervalDays,
      startDate: merged.startDate,
      endDate: merged.endDate,
    },
    all
  );
  if (conflicts.length > 0) {
    return {
      validation: {
        valid: false,
        errors: conflicts.map(
          (c) => `Conflicts with schedule "${c.name}".`
        ),
      },
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const updated: RecurringInvoiceTemplate = {
    ...merged,
    updatedAt: now,
    history: [
      ...merged.history,
      {
        id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
        scheduleId: id,
        action: "updated",
        timestamp: now,
      },
    ],
  };
  all[index] = updated;
  saveRecurringSchedules(all);
  return { schedule: updated, validation: { valid: true, errors: [] } };
}

export function deleteRecurringSchedule(id: string): boolean {
  const all = loadRecurringSchedules();
  const filtered = all.filter((s) => s.id !== id);
  if (filtered.length === all.length) return false;
  saveRecurringSchedules(filtered);
  return true;
}

function transitionSchedule(
  id: string,
  status: RecurringScheduleStatus,
  action: RecurringScheduleHistoryEntry["action"]
): RecurringInvoiceTemplate | undefined {
  const all = loadRecurringSchedules();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return undefined;

  const now = Math.floor(Date.now() / 1000);
  const current = all[index];
  const nextRunDate =
    status === "active"
      ? computeNextRunDate(current.intervalDays, now)
      : current.nextRunDate;

  const updated: RecurringInvoiceTemplate = {
    ...current,
    status,
    nextRunDate,
    updatedAt: now,
    history: [
      ...current.history,
      {
        id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
        scheduleId: id,
        action,
        timestamp: now,
      },
    ],
  };
  all[index] = updated;
  saveRecurringSchedules(all);
  return updated;
}

export function pauseRecurringSchedule(
  id: string
): RecurringInvoiceTemplate | undefined {
  return transitionSchedule(id, "paused", "paused");
}

export function resumeRecurringSchedule(
  id: string
): RecurringInvoiceTemplate | undefined {
  return transitionSchedule(id, "active", "resumed");
}

export function cancelRecurringSchedule(
  id: string
): RecurringInvoiceTemplate | undefined {
  return transitionSchedule(id, "cancelled", "cancelled");
}

/**
 * Record that an invoice was generated for a schedule and advance nextRunDate.
 */
export function recordScheduleInvoice(
  id: string,
  note?: string
): RecurringInvoiceTemplate | undefined {
  const all = loadRecurringSchedules();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return undefined;

  const now = Math.floor(Date.now() / 1000);
  const current = all[index];
  const updated: RecurringInvoiceTemplate = {
    ...current,
    nextRunDate: computeNextRunDate(current.intervalDays, current.nextRunDate),
    updatedAt: now,
    history: [
      ...current.history,
      {
        id: `hist_${now}_${Math.random().toString(36).slice(2, 8)}`,
        scheduleId: id,
        action: "invoice",
        timestamp: now,
        note,
      },
    ],
  };
  all[index] = updated;
  saveRecurringSchedules(all);
  return updated;
}

export function getScheduleHistory(
  id: string
): RecurringScheduleHistoryEntry[] {
  return getRecurringScheduleById(id)?.history ?? [];
}

export function loadSubscriptions(): Subscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((s) => ({
      ...s,
      recipients: (s.recipients as Array<{ address: string; amount: string }>).map(
        (r) => ({ ...r, amount: BigInt(r.amount) })
      ),
      totalUsdcCollected: BigInt(s.totalUsdcCollected as string),
      invoiceHistory: (s.invoiceHistory as Array<Record<string, unknown>>).map(
        (inv) => ({
          ...inv,
          amount: BigInt(inv.amount as string),
        })
      ),
    })) as Subscription[];
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs: Subscription[]): void {
  if (typeof window === "undefined") return;
  const serializable = subs.map((s) => ({
    ...s,
    recipients: s.recipients.map((r) => ({
      ...r,
      amount: r.amount.toString(),
    })),
    totalUsdcCollected: s.totalUsdcCollected.toString(),
    invoiceHistory: s.invoiceHistory.map((inv) => ({
      ...inv,
      amount: inv.amount.toString(),
    })),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export function getSubscriptionById(id: string): Subscription | undefined {
  return loadSubscriptions().find((s) => s.id === id);
}

export function frequencyToIntervalDays(freq: SubscriptionFrequency): number {
  switch (freq) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
  }
}

export function formatFrequency(freq: SubscriptionFrequency): string {
  switch (freq) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    case "monthly":
      return "Monthly";
  }
}

/**
 * Compute upcoming invoice dates from a subscription's config.
 * Returns the next N dates after `fromDate` (defaults to now).
 */
export function computeUpcomingDates(
  intervalDays: number,
  count: number,
  fromDate: Date = new Date()
): Date[] {
  const dates: Date[] = [];
  let current = new Date(fromDate);
  for (let i = 0; i < count; i++) {
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    dates.push(current);
  }
  return dates;
}

/**
 * Pause a subscription — sets status to "paused".
 */
export function pauseSubscription(sub: Subscription): Subscription {
  return { ...sub, status: "paused" as const };
}

/**
 * Resume a subscription — sets status to "active" and recomputes nextRunDate.
 */
export function resumeSubscription(sub: Subscription): Subscription {
  const now = Date.now() / 1000;
  const nextRunDate = now + sub.intervalDays * 86400;
  return { ...sub, status: "active" as const, nextRunDate };
}

/**
 * Cancel a subscription — sets status to "cancelled".
 */
export function cancelSubscription(sub: Subscription): Subscription {
  return { ...sub, status: "cancelled" as const };
}

/**
 * Format a subscription for display in the list.
 */
export function formatSubscriptionForDisplay(sub: Subscription) {
  return {
    ...sub,
    totalUsdcFormatted: formatAmount(sub.totalUsdcCollected),
    nextRunDateFormatted: new Date(sub.nextRunDate * 1000).toLocaleDateString(),
    createdAtFormatted: new Date(sub.createdAt * 1000).toLocaleDateString(),
    frequencyLabel: formatFrequency(sub.frequency),
  };
}
