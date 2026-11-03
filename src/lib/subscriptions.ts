export interface Subscription {
  id: string;
  name: string;
  status: string;
  startDate?: number;
  endDate?: number;
}

export async function loadSubscriptions(publicKey?: string): Promise<Subscription[]> {
  return [];
}

export async function createSubscription(data: any): Promise<Subscription> {
  return { id: '1', name: '', status: 'active' };
}

export async function updateSubscription(id: string, data: any): Promise<Subscription> {
  return { id, name: '', status: 'active' };
}

export async function deleteSubscription(id: string): Promise<void> {}

export async function pauseSubscription(id: string): Promise<Subscription> {
  return { id, name: '', status: 'paused' };
}

export async function resumeSubscription(id: string): Promise<Subscription> {
  return { id, name: '', status: 'active' };
}

export async function modifySubscription(id: string, data: any): Promise<Subscription> {
  return { id, name: '', status: 'active' };
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  return { id, name: '', status: 'cancelled' };
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {}

export function formatSubscriptionForDisplay(subscription: Subscription): any {
  return { ...subscription };
}

export function formatFrequency(frequency: string): string {
  return frequency;
}

export function computeUpcomingDates(frequency: string, startDate: number, count: number): number[] {
  return [];
}
