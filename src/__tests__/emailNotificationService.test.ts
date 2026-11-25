import {
  registerEmailTemplate,
  renderEmailTemplate,
  sendEmailNotification,
  sendBulkEmailNotifications,
  getDeliveryLog,
  getDeliveryRecord,
  clearDeliveryLog,
  clearEmailTemplates,
  setSendFunction,
  getEmailTemplate,
} from '@/services/emailNotificationService';

beforeEach(() => {
  clearDeliveryLog();
  clearEmailTemplates();
  // Reset to default no-op sender
  setSendFunction(async (_to, _subject) => `msg-${Date.now()}`);
});

describe('emailNotificationService', () => {
  describe('sends emails', () => {
    it('sends a basic email and returns success', async () => {
      const result = await sendEmailNotification({
        to: 'user@example.com',
        subject: 'Hello',
        body: 'World',
      });
      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it('records delivery after sending', async () => {
      await sendEmailNotification({ to: 'a@b.com', subject: 'Test', body: 'Body' });
      const log = getDeliveryLog();
      expect(log).toHaveLength(1);
      expect(log[0].to).toBe('a@b.com');
      expect(log[0].status).toBe('sent');
    });
  });

  describe('templates work', () => {
    it('registers and retrieves a template', () => {
      registerEmailTemplate({ id: 'welcome', subject: 'Welcome!', body: 'Hi {{name}}' });
      const tpl = getEmailTemplate('welcome');
      expect(tpl).toBeDefined();
      expect(tpl!.id).toBe('welcome');
    });

    it('renders template with variable substitution', () => {
      registerEmailTemplate({ id: 'invoice', subject: 'Invoice #{{id}}', body: 'Amount: {{amount}}' });
      const rendered = renderEmailTemplate('invoice', { id: '42', amount: '$100' });
      expect(rendered.subject).toBe('Invoice #42');
      expect(rendered.body).toBe('Amount: $100');
    });

    it('sends email using template', async () => {
      registerEmailTemplate({ id: 'notify', subject: 'Hi {{name}}', body: 'Your order {{order}} is ready' });
      const result = await sendEmailNotification({
        to: 'user@test.com',
        templateId: 'notify',
        templateVars: { name: 'Alice', order: 'ORD-123' },
      });
      expect(result.success).toBe(true);
      const log = getDeliveryLog();
      expect(log[0].subject).toBe('Hi Alice');
    });

    it('throws when template not found', () => {
      expect(() => renderEmailTemplate('nonexistent')).toThrow('Email template not found: nonexistent');
    });
  });

  describe('retries work', () => {
    it('retries on failure and succeeds on second attempt', async () => {
      let callCount = 0;
      setSendFunction(async () => {
        callCount++;
        if (callCount < 2) throw new Error('transient error');
        return 'msg-ok';
      });

      const result = await sendEmailNotification({
        to: 'retry@test.com',
        subject: 'Retry test',
        body: 'body',
        maxRetries: 3,
      });
      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('marks delivery as failed after all retries exhausted', async () => {
      setSendFunction(async () => { throw new Error('permanent failure'); });

      const result = await sendEmailNotification({
        to: 'fail@test.com',
        subject: 'Fail test',
        body: 'body',
        maxRetries: 2,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('permanent failure');
      const record = getDeliveryRecord(result.deliveryId);
      expect(record?.status).toBe('failed');
      expect(record?.attempts).toBe(2);
    });
  });

  describe('tracking works', () => {
    it('tracks delivery status as sent', async () => {
      const result = await sendEmailNotification({ to: 'track@test.com', subject: 'Track', body: 'me' });
      const record = getDeliveryRecord(result.deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe('sent');
      expect(record!.sentAt).toBeDefined();
    });

    it('tracks multiple deliveries', async () => {
      await sendBulkEmailNotifications([
        { to: 'a@test.com', subject: 'A', body: 'a' },
        { to: 'b@test.com', subject: 'B', body: 'b' },
        { to: 'c@test.com', subject: 'C', body: 'c' },
      ]);
      expect(getDeliveryLog()).toHaveLength(3);
    });

    it('tracks failed delivery with error info', async () => {
      setSendFunction(async () => { throw new Error('smtp down'); });
      const result = await sendEmailNotification({ to: 'x@test.com', subject: 'X', body: 'x', maxRetries: 1 });
      const record = getDeliveryRecord(result.deliveryId);
      expect(record?.status).toBe('failed');
      expect(record?.error).toContain('smtp down');
    });
  });
});
