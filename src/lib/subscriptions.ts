import type { Subscription, SubscriptionFrequency } from "@/types/subscription";

export type { Subscription, SubscriptionFrequency };

export async function loadSubscriptions(publicKey?: string): Promise<Subscription[]> {
  return [];
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

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {}

export function formatSubscriptionForDisplay(subscription: Subscription): any {
  return {
    ...subscription,
    createdAtFormatted: new Date(subscription.createdAt).toLocaleString(),
    nextRunDateFormatted: new Date(subscription.nextRunDate).toLocaleString(),
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
