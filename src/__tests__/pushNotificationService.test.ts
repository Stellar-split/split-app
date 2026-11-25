import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerDevice,
  deactivateDevice,
  getActiveSubscriptions,
  sendNotification,
  markDelivered,
  recordEngagement,
  getEngagementStats,
  getDeliveriesByUser,
  resetPushNotificationStore,
} from '@/services/pushNotificationService';
import type { PushNotificationPayload } from '@/services/pushNotificationService';

const payload: PushNotificationPayload = {
  title: 'Invoice paid',
  body: 'Your invoice #42 has been paid.',
};

beforeEach(() => {
  resetPushNotificationStore();
});

describe('pushNotificationService', () => {
  describe('registerDevice', () => {
    it('registers a device and returns a subscription', () => {
      const sub = registerDevice({ userId: 'u1', platform: 'ios', token: 'tok-1' });
      expect(sub.id).toBeTruthy();
      expect(sub.active).toBe(true);
      expect(sub.platform).toBe('ios');
    });

    it('registers multiple devices for one user', () => {
      registerDevice({ userId: 'u1', platform: 'ios', token: 'tok-1' });
      registerDevice({ userId: 'u1', platform: 'android', token: 'tok-2' });
      expect(getActiveSubscriptions('u1')).toHaveLength(2);
    });
  });

  describe('deactivateDevice', () => {
    it('deactivates a device', () => {
      const sub = registerDevice({ userId: 'u1', platform: 'web', token: 'tok-3' });
      deactivateDevice(sub.id);
      expect(getActiveSubscriptions('u1')).toHaveLength(0);
    });
  });

  describe('sendNotification', () => {
    it('sends to all active devices', () => {
      registerDevice({ userId: 'u2', platform: 'ios', token: 'tok-a' });
      registerDevice({ userId: 'u2', platform: 'android', token: 'tok-b' });
      const deliveries = sendNotification('u2', payload);
      expect(deliveries).toHaveLength(2);
      deliveries.forEach(d => {
        expect(d.status).toBe('sent');
        expect(d.payload.title).toBe('Invoice paid');
      });
    });

    it('returns empty array if user has no active subscriptions', () => {
      const deliveries = sendNotification('no-devices', payload);
      expect(deliveries).toEqual([]);
    });

    it('skips deactivated devices', () => {
      const sub = registerDevice({ userId: 'u3', platform: 'ios', token: 'tok-c' });
      registerDevice({ userId: 'u3', platform: 'android', token: 'tok-d' });
      deactivateDevice(sub.id);
      const deliveries = sendNotification('u3', payload);
      expect(deliveries).toHaveLength(1);
    });
  });

  describe('markDelivered', () => {
    it('marks a delivery as delivered', () => {
      registerDevice({ userId: 'u4', platform: 'ios', token: 'tok-e' });
      const [delivery] = sendNotification('u4', payload);
      const updated = markDelivered(delivery.id);
      expect(updated.status).toBe('delivered');
      expect(updated.deliveredAt).toBeDefined();
    });

    it('throws for unknown delivery id', () => {
      expect(() => markDelivered('ghost')).toThrow();
    });
  });

  describe('recordEngagement / getEngagementStats', () => {
    it('records engagement and computes stats', () => {
      registerDevice({ userId: 'u5', platform: 'ios', token: 'tok-f' });
      const [d1] = sendNotification('u5', payload);
      const [d2] = sendNotification('u5', { title: 'Reminder', body: 'Pay now' });
      recordEngagement({ userId: 'u5', notificationId: d1.id, action: 'opened' });
      recordEngagement({ userId: 'u5', notificationId: d2.id, action: 'dismissed' });
      const stats = getEngagementStats('u5');
      expect(stats.totalSent).toBe(2);
      expect(stats.totalOpened).toBe(1);
      expect(stats.openRate).toBeCloseTo(0.5);
    });

    it('returns zero stats for user with no activity', () => {
      const stats = getEngagementStats('ghost');
      expect(stats.totalSent).toBe(0);
      expect(stats.openRate).toBe(0);
    });
  });

  describe('getDeliveriesByUser', () => {
    it('returns all deliveries for a user', () => {
      registerDevice({ userId: 'u6', platform: 'web', token: 'tok-g' });
      sendNotification('u6', payload);
      sendNotification('u6', { title: 'Second', body: 'msg' });
      expect(getDeliveriesByUser('u6')).toHaveLength(2);
    });
  });
});
