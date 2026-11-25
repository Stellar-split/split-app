export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
}

export interface SmsMessage {
  id: string;
  to: string;
  body: string;
  templateId?: string;
  status: SmsStatus;
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
  error?: string;
}

export interface SmsDeliveryRecord {
  messageId: string;
  to: string;
  status: SmsStatus;
  timestamp: number;
}

export interface SmsRateLimitConfig {
  maxPerMinute: number;
  maxPerHour: number;
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

let msgCounter = 0;
function genMsgId(): string {
  return `sms-${++msgCounter}`;
}

const templates = new Map<string, SmsTemplate>();
const messages = new Map<string, SmsMessage>();
const deliveryRecords = new Map<string, SmsDeliveryRecord>();

let rateLimitConfig: SmsRateLimitConfig = {
  maxPerMinute: 10,
  maxPerHour: 100,
};

export function registerTemplate(template: SmsTemplate): void {
  templates.set(template.id, template);
}

export function getTemplate(id: string): SmsTemplate | undefined {
  return templates.get(id);
}

export function renderTemplate(templateId: string, variables: Record<string, string>): string {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Template '${templateId}' not found`);
  }

  return template.body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

function checkRateLimit(to: string, now: number): void {
  const recipientMessages = Array.from(messages.values()).filter(m => m.to === to && m.sentAt !== undefined);

  const oneMinuteAgo = now - 60_000;
  const oneHourAgo = now - 3_600_000;

  const sentInLastMinute = recipientMessages.filter(m => (m.sentAt ?? 0) >= oneMinuteAgo).length;
  const sentInLastHour = recipientMessages.filter(m => (m.sentAt ?? 0) >= oneHourAgo).length;

  if (sentInLastMinute >= rateLimitConfig.maxPerMinute) {
    throw new Error('Rate limit exceeded');
  }
  if (sentInLastHour >= rateLimitConfig.maxPerHour) {
    throw new Error('Rate limit exceeded');
  }
}

export function sendSms(to: string, body: string, templateId?: string, now?: number): SmsMessage {
  if (!E164_REGEX.test(to)) {
    throw new Error(`Invalid phone number: '${to}'. Must be in E.164 format.`);
  }

  const ts = now ?? Date.now();
  checkRateLimit(to, ts);

  const msg: SmsMessage = {
    id: genMsgId(),
    to,
    body,
    templateId,
    status: 'sent',
    createdAt: ts,
    sentAt: ts,
  };

  messages.set(msg.id, msg);

  const deliveryRecord: SmsDeliveryRecord = {
    messageId: msg.id,
    to,
    status: msg.status,
    timestamp: ts,
  };
  deliveryRecords.set(msg.id, deliveryRecord);

  return msg;
}

export function sendTemplatedSms(
  to: string,
  templateId: string,
  variables: Record<string, string>,
  now?: number,
): SmsMessage {
  const body = renderTemplate(templateId, variables);
  return sendSms(to, body, templateId, now);
}

export function updateSmsStatus(messageId: string, status: SmsStatus, now?: number): SmsMessage {
  const msg = messages.get(messageId);
  if (!msg) {
    throw new Error(`Message '${messageId}' not found`);
  }

  const ts = now ?? Date.now();
  const updated: SmsMessage = {
    ...msg,
    status,
    deliveredAt: status === 'delivered' ? ts : msg.deliveredAt,
  };
  messages.set(messageId, updated);

  const deliveryRecord = deliveryRecords.get(messageId);
  if (deliveryRecord) {
    deliveryRecords.set(messageId, { ...deliveryRecord, status, timestamp: ts });
  }

  return updated;
}

export function getMessagesByRecipient(to: string): SmsMessage[] {
  return Array.from(messages.values()).filter(m => m.to === to);
}

export function getDeliveryRecord(messageId: string): SmsDeliveryRecord | undefined {
  return deliveryRecords.get(messageId);
}

export function configureSmsRateLimit(config: SmsRateLimitConfig): void {
  rateLimitConfig = { ...config };
}

export function resetSmsStore(): void {
  templates.clear();
  messages.clear();
  deliveryRecords.clear();
  msgCounter = 0;
  rateLimitConfig = { maxPerMinute: 10, maxPerHour: 100 };
}
