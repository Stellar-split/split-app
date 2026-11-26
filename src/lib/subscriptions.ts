import type { Subscription, SubscriptionFrequency } from "@/types/subscription";

export type { Subscription, SubscriptionFrequency };

const STORAGE_KEY = "stellar_split_subscriptions";

function reviveSubscription(raw: any): Subscription {
  return {
    ...raw,
    recipients: (raw.recipients ?? []).map((r: any) => ({ ...r, amount: BigInt(r.amount) })),
    totalUsdcCollected: BigInt(raw.totalUsdcCollected ?? 0),
    invoiceHistory: (raw.invoiceHistory ?? []).map((inv: any) => ({ ...inv, amount: BigInt(inv.amount) })),
  };
}

function serializeSubscription(sub: Subscription): any {
  return {
    ...sub,
    recipients: sub.recipients.map((r) => ({ ...r, amount: r.amount.toString() })),
    totalUsdcCollected: sub.totalUsdcCollected.toString(),
    invoiceHistory: sub.invoiceHistory.map((inv) => ({ ...inv, amount: inv.amount.toString() })),
  };
}

export async function loadSubscriptions(publicKey?: string): Promise<Subscription[]> {
  if (typeof localStorage === "undefined") return [];
  let subscriptions: Subscription[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    subscriptions = (Array.isArray(parsed) ? parsed : []).map(reviveSubscription);
  } catch {
    return [];
  }
  return publicKey ? subscriptions.filter((s) => s.creator === publicKey) : subscriptions;
}

export async function createSubscription(data: any): Promise<Subscription> {
  return { id: '1', templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'active', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function updateSubscription(id: string, data: any): Promise<Subscription> {
  return { id, templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'active', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function deleteSubscription(id: string): Promise<void> {}

export async function pauseSubscription(id: string): Promise<Subscription> {
  return { id, templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'paused', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function resumeSubscription(id: string): Promise<Subscription> {
  return { id, templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'active', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function modifySubscription(id: string, data: any): Promise<Subscription> {
  return { id, templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'active', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  return { id, templateName: '', creator: '', recipients: [], frequency: 'monthly', intervalDays: 30, status: 'cancelled', createdAt: 0, nextRunDate: 0, lastRunDate: null, token: '', totalInvoicesGenerated: 0, totalUsdcCollected: 0n, invoiceHistory: [] };
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions.map(serializeSubscription)));
  } catch {
    // Storage may be unavailable (quota exceeded, private browsing); drop silently.
  }
}

export function formatSubscriptionForDisplay(subscription: Subscription): any {
  return {
    ...subscription,
    createdAtFormatted: new Date(subscription.createdAt * 1000).toLocaleString(),
    nextRunDateFormatted: new Date(subscription.nextRunDate * 1000).toLocaleString(),
    totalUsdcFormatted: (Number(subscription.totalUsdcCollected) / 1_000_000).toFixed(2),
  };
}

export function formatFrequency(frequency: SubscriptionFrequency): string {
  const map: Record<SubscriptionFrequency, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
  };
  return map[frequency];
}

export function computeUpcomingDates(frequency: string, fromDate: number, count: number): number[] {
  const dates: number[] = [];
  const intervalDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
  let current = fromDate;
  for (let i = 0; i < count; i++) {
    current += intervalDays * 24 * 60 * 60 * 1000;
    dates.push(current);
  }
  return dates;
}

export function aggregateSubscriptionAnalytics(subscriptions: Subscription[] | undefined, from: number, to: number): any {
  if (!subscriptions) return {};
  return {
    totalSubscriptions: subscriptions.length,
    activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
    pausedSubscriptions: subscriptions.filter((s) => s.status === 'paused').length,
    cancelledSubscriptions: subscriptions.filter((s) => s.status === 'cancelled').length,
  };
}
