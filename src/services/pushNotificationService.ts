export type DevicePlatform = 'ios' | 'android' | 'web';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface DeviceSubscription {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  createdAt: number;
  active: boolean;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
}

export interface NotificationDelivery {
  id: string;
  subscriptionId: string;
  userId: string;
  payload: PushNotificationPayload;
  status: NotificationStatus;
  sentAt?: number;
  deliveredAt?: number;
  error?: string;
}

export interface EngagementRecord {
  userId: string;
  notificationId: string;
  action: 'received' | 'opened' | 'dismissed';
  timestamp: number;
}

export interface EngagementStats {
  userId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  openRate: number;
}

let subCounter = 0;
let deliveryCounter = 0;

function genSubId(): string {
  return `sub-${++subCounter}`;
}

function genDeliveryId(): string {
  return `del-${++deliveryCounter}`;
}

const subscriptions = new Map<string, DeviceSubscription>();
const deliveries = new Map<string, NotificationDelivery>();
const engagements: EngagementRecord[] = [];

export function registerDevice(
  sub: Omit<DeviceSubscription, 'id' | 'createdAt' | 'active'>,
  now?: number,
): DeviceSubscription {
  const ts = now ?? Date.now();
  const device: DeviceSubscription = {
    id: genSubId(),
    userId: sub.userId,
    platform: sub.platform,
    token: sub.token,
    createdAt: ts,
    active: true,
  };
  subscriptions.set(device.id, device);
  return device;
}

export function deactivateDevice(subscriptionId: string): void {
  const sub = subscriptions.get(subscriptionId);
  if (sub) {
    subscriptions.set(subscriptionId, { ...sub, active: false });
  }
}

export function getActiveSubscriptions(userId: string): DeviceSubscription[] {
  return Array.from(subscriptions.values()).filter(s => s.userId === userId && s.active);
}

export function sendNotification(
  userId: string,
  payload: PushNotificationPayload,
  now?: number,
): NotificationDelivery[] {
  const ts = now ?? Date.now();
  const activeSubs = getActiveSubscriptions(userId);

  if (activeSubs.length === 0) {
    return [];
  }

  const result: NotificationDelivery[] = [];

  for (const sub of activeSubs) {
    const delivery: NotificationDelivery = {
      id: genDeliveryId(),
      subscriptionId: sub.id,
      userId,
      payload,
      status: 'sent',
      sentAt: ts,
    };
    deliveries.set(delivery.id, delivery);
    result.push(delivery);
  }

  return result;
}

export function markDelivered(deliveryId: string, now?: number): NotificationDelivery {
  const delivery = deliveries.get(deliveryId);
  if (!delivery) {
    throw new Error(`Delivery '${deliveryId}' not found`);
  }

  const ts = now ?? Date.now();
  const updated: NotificationDelivery = {
    ...delivery,
    status: 'delivered',
    deliveredAt: ts,
  };
  deliveries.set(deliveryId, updated);
  return updated;
}

export function recordEngagement(
  engagement: Omit<EngagementRecord, 'timestamp'>,
  now?: number,
): EngagementRecord {
  const ts = now ?? Date.now();
  const record: EngagementRecord = { ...engagement, timestamp: ts };
  engagements.push(record);
  return record;
}

export function getEngagementStats(userId: string): EngagementStats {
  const userDeliveries = Array.from(deliveries.values()).filter(d => d.userId === userId);
  const totalSent = userDeliveries.length;
  const totalDelivered = userDeliveries.filter(d => d.status === 'delivered').length;

  const userEngagements = engagements.filter(e => e.userId === userId);
  const totalOpened = userEngagements.filter(e => e.action === 'opened').length;

  const openRate = totalSent === 0 ? 0 : totalOpened / totalSent;

  return {
    userId,
    totalSent,
    totalDelivered,
    totalOpened,
    openRate,
  };
}

export function getDeliveriesByUser(userId: string): NotificationDelivery[] {
  return Array.from(deliveries.values()).filter(d => d.userId === userId);
}

export function resetPushNotificationStore(): void {
  subscriptions.clear();
  deliveries.clear();
  engagements.length = 0;
  subCounter = 0;
  deliveryCounter = 0;
}
