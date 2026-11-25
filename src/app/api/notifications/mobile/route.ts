import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
  sendMobileNotification,
  scheduleNotification,
  getPendingSchedules,
  getDueSchedules,
  getBadgeCount,
  updateBadgeCount,
  trackNotificationEvent,
  getNotificationAnalytics,
  getAnalyticsSummary,
  type MobileNotificationPayload,
  type NotificationSchedule,
} from '@/lib/mobileNotifications';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'schedules') {
    const type = searchParams.get('type') ?? 'pending';
    const data = type === 'due' ? getDueSchedules() : getPendingSchedules();
    return NextResponse.json({ schedules: data });
  }

  if (action === 'badge') {
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    return NextResponse.json({ badge: getBadgeCount(userId) });
  }

  if (action === 'analytics') {
    const notificationId = searchParams.get('notificationId') ?? undefined;
    if (notificationId) {
      return NextResponse.json({ events: getNotificationAnalytics(notificationId) });
    }
    return NextResponse.json({ summary: getAnalyticsSummary() });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { action } = body;

  if (action === 'send') {
    const payload = body.payload as MobileNotificationPayload | undefined;
    if (!payload?.id || !payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'payload.id, title and body are required' }, { status: 400 });
    }
    const result = await sendMobileNotification(payload);
    return NextResponse.json(result);
  }

  if (action === 'register-device') {
    const { userId, token, platform } = body;
    if (!userId || !token) {
      return NextResponse.json({ error: 'userId and token are required' }, { status: 400 });
    }
    registerDeviceToken(userId, token, platform === 'android' ? 'android' : 'web');
    return NextResponse.json({ registered: true });
  }

  if (action === 'schedule') {
    const schedule = body.schedule as NotificationSchedule | undefined;
    if (!schedule?.id || !schedule?.payload || !schedule?.scheduledAt) {
      return NextResponse.json({ error: 'schedule.id, payload and scheduledAt are required' }, { status: 400 });
    }
    scheduleNotification(schedule);
    return NextResponse.json({ scheduled: true });
  }

  if (action === 'badge') {
    const { userId, counts } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const badge = updateBadgeCount(userId, counts ?? {});
    return NextResponse.json({ badge });
  }

  if (action === 'analytics') {
    const { notificationId, event, deepLink } = body;
    if (!notificationId || !event) {
      return NextResponse.json({ error: 'notificationId and event are required' }, { status: 400 });
    }
    trackNotificationEvent({ notificationId, event, timestamp: Date.now(), deepLink });
    return NextResponse.json({ tracked: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
