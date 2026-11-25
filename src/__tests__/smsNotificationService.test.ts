import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTemplate,
  getTemplate,
  renderTemplate,
  sendSms,
  sendTemplatedSms,
  updateSmsStatus,
  getMessagesByRecipient,
  getDeliveryRecord,
  configureSmsRateLimit,
  resetSmsStore,
} from '@/services/smsNotificationService';

const PHONE = '+15555550100';

beforeEach(() => {
  resetSmsStore();
});

describe('smsNotificationService', () => {
  describe('registerTemplate / getTemplate', () => {
    it('stores and retrieves a template', () => {
      registerTemplate({ id: 't1', name: 'Invoice', body: 'Invoice {{number}} is due.' });
      const tpl = getTemplate('t1');
      expect(tpl).toBeDefined();
      expect(tpl!.name).toBe('Invoice');
    });

    it('returns undefined for unknown template', () => {
      expect(getTemplate('nope')).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('replaces variables', () => {
      registerTemplate({ id: 't2', name: 'Pay', body: 'Hi {{name}}, pay {{amount}}.' });
      const rendered = renderTemplate('t2', { name: 'Alice', amount: '$50' });
      expect(rendered).toBe('Hi Alice, pay $50.');
    });

    it('leaves unknown placeholders intact', () => {
      registerTemplate({ id: 't3', name: 'Test', body: 'Hello {{name}} {{missing}}.' });
      const rendered = renderTemplate('t3', { name: 'Bob' });
      expect(rendered).toBe('Hello Bob {{missing}}.');
    });

    it('throws for unknown template id', () => {
      expect(() => renderTemplate('no-tpl', {})).toThrow();
    });
  });

  describe('sendSms', () => {
    it('sends a message and returns record', () => {
      const msg = sendSms(PHONE, 'Hello!');
      expect(msg.id).toBeTruthy();
      expect(msg.to).toBe(PHONE);
      expect(msg.body).toBe('Hello!');
      expect(msg.status).toBe('sent');
      expect(msg.sentAt).toBeDefined();
    });

    it('throws for invalid phone number', () => {
      expect(() => sendSms('not-a-number', 'Hi')).toThrow(/invalid/i);
      expect(() => sendSms('5555550100', 'Hi')).toThrow(/invalid/i);
    });

    it('enforces per-minute rate limit', () => {
      configureSmsRateLimit({ maxPerMinute: 2, maxPerHour: 100 });
      const now = Date.now();
      sendSms(PHONE, 'msg1', undefined, now);
      sendSms(PHONE, 'msg2', undefined, now);
      expect(() => sendSms(PHONE, 'msg3', undefined, now)).toThrow(/rate limit/i);
    });

    it('enforces per-hour rate limit', () => {
      configureSmsRateLimit({ maxPerMinute: 100, maxPerHour: 2 });
      const now = Date.now();
      sendSms(PHONE, 'msg1', undefined, now);
      sendSms(PHONE, 'msg2', undefined, now);
      expect(() => sendSms(PHONE, 'msg3', undefined, now)).toThrow(/rate limit/i);
    });

    it('does not apply rate limit to different recipients', () => {
      configureSmsRateLimit({ maxPerMinute: 2, maxPerHour: 100 });
      const now = Date.now();
      sendSms(PHONE, 'msg1', undefined, now);
      sendSms(PHONE, 'msg2', undefined, now);
      // Different phone — should be fine
      expect(() => sendSms('+15555550199', 'msg', undefined, now)).not.toThrow();
    });
  });

  describe('sendTemplatedSms', () => {
    it('renders template and sends', () => {
      registerTemplate({ id: 'inv', name: 'Invoice', body: 'Invoice {{id}} due.' });
      const msg = sendTemplatedSms(PHONE, 'inv', { id: '#99' });
      expect(msg.body).toBe('Invoice #99 due.');
      expect(msg.templateId).toBe('inv');
    });
  });

  describe('updateSmsStatus', () => {
    it('updates message status', () => {
      const msg = sendSms(PHONE, 'Hello');
      const updated = updateSmsStatus(msg.id, 'delivered');
      expect(updated.status).toBe('delivered');
      expect(updated.deliveredAt).toBeDefined();
    });

    it('throws for unknown message id', () => {
      expect(() => updateSmsStatus('ghost', 'delivered')).toThrow();
    });
  });

  describe('getMessagesByRecipient', () => {
    it('returns messages for a recipient', () => {
      sendSms(PHONE, 'First');
      sendSms(PHONE, 'Second');
      const msgs = getMessagesByRecipient(PHONE);
      expect(msgs).toHaveLength(2);
    });

    it('returns empty array for unknown recipient', () => {
      expect(getMessagesByRecipient('+19999999999')).toEqual([]);
    });
  });

  describe('getDeliveryRecord', () => {
    it('returns delivery record for a message', () => {
      const msg = sendSms(PHONE, 'Track me');
      const rec = getDeliveryRecord(msg.id);
      expect(rec).toBeDefined();
      expect(rec!.messageId).toBe(msg.id);
      expect(rec!.to).toBe(PHONE);
    });
  });
});
