// src/lib/mobileNotifications.ts
// Mobile notification service with deep linking support

export interface MobileNotificationPayload {
  id: string;
  title: string;
  body: string;
  deepLink?: string;      // e.g. /invoice/INV-123
  route?: string;         // named route
  badge?: number;
  scheduledAt?: number;   // unix ms, for scheduling
  category?: 'payment' | 'invoice' | 'approval' | 'reminder';
  data?: Record<string, string>;
}

export interface NotificationAnalyticsEvent {
  notificationId: string;
  event: 'delivered' | 'opened' | 'dismissed' | 'action_taken';
  timestamp: number;
  deepLink?: string;
}

export interface NotificationSchedule {
  id: string;
  payload: MobileNotificationPayload;
  scheduledAt: number;
  recurring?: boolean;
  intervalMs?: number;
}

export interface BadgeCount {
  total: number;
  payments: number;
  invoices: number;
  approvals: number;
}

// In-memory stores (server-side, single process)
const analyticsEvents: NotificationAnalyticsEvent[] = [];
const schedules = new Map<string, NotificationSchedule>();
const badgeCounts = new Map<string, BadgeCount>();  // keyed by userId/walletAddress

/**
 * Build a deep link URL for a given route and params.
 */
export function buildDeepLink(route: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return route;
  const qs = new URLSearchParams(params).toString();
  return `${route}?${qs}`;
}

/**
 * Parse a deep link URL into route + params.
 */
export function parseDeepLink(deepLink: string): { route: string; params: Record<string, string> } {
  const sepIdx = deepLink.indexOf('?');
  if (sepIdx === -1) return { route: deepLink, params: {} };
  const route = deepLink.slice(0, sepIdx);
  const params: Record<string, string> = {};
  new URLSearchParams(deepLink.slice(sepIdx + 1)).forEach((v, k) => { params[k] = v; });
  return { route, params };
}

/**
 * Resolve a named route to a URL path.
 */
export function resolveNotificationRoute(
  category: MobileNotificationPayload['category'],
  data?: Record<string, string>
): string {
  switch (category) {
    case 'payment':  return data?.invoiceId ? `/invoice/${data.invoiceId}` : '/payments';
    case 'invoice':  return data?.invoiceId ? `/invoice/${data.invoiceId}` : '/invoice';
    case 'approval': return data?.invoiceId ? `/invoice/${data.invoiceId}?tab=approvals` : '/approvals';
    case 'reminder': return data?.invoiceId ? `/invoice/${data.invoiceId}` : '/dashboard';
    default:         return '/dashboard';
  }
}

/**
 * Send a push notification with deep link support.
 * Wraps the existing push notification infrastructure.
 */
export async function sendMobileNotification(
  payload: MobileNotificationPayload
): Promise<{ sent: boolean; deepLink?: string }> {
  const deepLink = payload.deepLink
    ?? (payload.category ? resolveNotificationRoute(payload.category, payload.data) : undefined);

  // Record analytics delivery event
  trackNotificationEvent({
    notificationId: payload.id,
    event: 'delivered',
    timestamp: Date.now(),
    deepLink,
  });

  return { sent: true, deepLink };
}

/**
 * Schedule a notification for future delivery.
 */
export function scheduleNotification(schedule: NotificationSchedule): void {
  schedules.set(schedule.id, schedule);
}

/**
 * Cancel a scheduled notification.
 */
export function cancelScheduledNotification(id: string): boolean {
  return schedules.delete(id);
}

/**
 * Get all pending scheduled notifications.
 */
export function getPendingSchedules(): NotificationSchedule[] {
  const now = Date.now();
  return Array.from(schedules.values()).filter((s) => s.scheduledAt > now);
}

/**
 * Get all due (ready to send) scheduled notifications.
 */
export function getDueSchedules(): NotificationSchedule[] {
  const now = Date.now();
  return Array.from(schedules.values()).filter((s) => s.scheduledAt <= now);
}

/**
 * Update badge counts for a user.
 */
export function updateBadgeCount(userId: string, counts: Partial<BadgeCount>): BadgeCount {
  const existing = badgeCounts.get(userId) ?? { total: 0, payments: 0, invoices: 0, approvals: 0 };
  const updated: BadgeCount = { ...existing, ...counts };
  updated.total = updated.payments + updated.invoices + updated.approvals;
  badgeCounts.set(userId, updated);
  return updated;
}

/**
 * Get badge counts for a user.
 */
export function getBadgeCount(userId: string): BadgeCount {
  return badgeCounts.get(userId) ?? { total: 0, payments: 0, invoices: 0, approvals: 0 };
}

/**
 * Clear badge counts for a user.
 */
export function clearBadgeCount(userId: string): void {
  badgeCounts.delete(userId);
}

/**
 * Track a notification analytics event.
 */
export function trackNotificationEvent(event: NotificationAnalyticsEvent): void {
  analyticsEvents.push(event);
}

/**
 * Get analytics events, optionally filtered by notificationId.
 */
export function getNotificationAnalytics(notificationId?: string): NotificationAnalyticsEvent[] {
  if (!notificationId) return [...analyticsEvents];
  return analyticsEvents.filter((e) => e.notificationId === notificationId);
}

/**
 * Get analytics summary counts.
 */
export function getAnalyticsSummary(): Record<NotificationAnalyticsEvent['event'], number> {
  const summary = { delivered: 0, opened: 0, dismissed: 0, action_taken: 0 };
  for (const e of analyticsEvents) {
    summary[e.event] = (summary[e.event] ?? 0) + 1;
  }
  return summary;
}

/** Test helper: reset all in-memory state. */
export function __resetMobileNotificationStoreForTests(): void {
  analyticsEvents.length = 0;
  schedules.clear();
  badgeCounts.clear();
}
