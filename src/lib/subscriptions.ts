import { formatAmount } from "@stellar-split/sdk";
import type {
  Subscription,
  SubscriptionFrequency,
  SubscriptionInvoice,
} from "@/types/subscription";

const STORAGE_KEY = "stellar_split_subscriptions";

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
