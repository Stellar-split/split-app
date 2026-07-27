/**
 * Server-side registry of Web Push subscriptions and funding-milestone
 * notification state, keyed per invoice. This project has no database, so
 * state lives in memory for the lifetime of the server process — acceptable
 * for a single-instance dev/demo deployment, but it resets on restart and
 * won't fan out across multiple server instances.
 */

export interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const subscriptionsByInvoice = new Map<string, Map<string, StoredPushSubscription>>();
const notifiedMilestonesByInvoice = new Map<string, Set<number>>();

export function addSubscription(invoiceId: string, subscription: StoredPushSubscription): void {
  let subs = subscriptionsByInvoice.get(invoiceId);
  if (!subs) {
    subs = new Map();
    subscriptionsByInvoice.set(invoiceId, subs);
  }
  subs.set(subscription.endpoint, subscription);
}

export function removeSubscription(invoiceId: string, endpoint: string): void {
  subscriptionsByInvoice.get(invoiceId)?.delete(endpoint);
}

/** Remove a subscription endpoint from every invoice it was registered against. */
export function removeSubscriptionEverywhere(endpoint: string): void {
  for (const subs of subscriptionsByInvoice.values()) {
    subs.delete(endpoint);
  }
}

export function getSubscriptions(invoiceId: string): StoredPushSubscription[] {
  return [...(subscriptionsByInvoice.get(invoiceId)?.values() ?? [])];
}

export function isSubscribed(invoiceId: string, endpoint: string): boolean {
  return subscriptionsByInvoice.get(invoiceId)?.has(endpoint) ?? false;
}

export function listTrackedInvoiceIds(): string[] {
  return [...subscriptionsByInvoice.keys()].filter((id) => (subscriptionsByInvoice.get(id)?.size ?? 0) > 0);
}

export function getNotifiedMilestones(invoiceId: string): Set<number> {
  return notifiedMilestonesByInvoice.get(invoiceId) ?? new Set();
}

export function markMilestoneNotified(invoiceId: string, milestone: number): void {
  let set = notifiedMilestonesByInvoice.get(invoiceId);
  if (!set) {
    set = new Set();
    notifiedMilestonesByInvoice.set(invoiceId, set);
  }
  set.add(milestone);
}

/** Test-only: reset all in-memory state between test cases. */
export function __resetPushSubscriptionStoreForTests(): void {
  subscriptionsByInvoice.clear();
  notifiedMilestonesByInvoice.clear();
}
