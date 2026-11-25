/**
 * Email Notification Service (#1173)
 *
 * Provides email sending with template support, retry logic, and delivery tracking.
 */

export interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
}

export interface EmailOptions {
  to: string;
  templateId?: string;
  templateVars?: Record<string, string>;
  subject?: string;
  body?: string;
  maxRetries?: number;
}

export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export interface DeliveryRecord {
  id: string;
  to: string;
  subject: string;
  status: DeliveryStatus;
  attempts: number;
  sentAt?: number;
  error?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  deliveryId: string;
  error?: string;
}

// In-memory stores
const templates = new Map<string, EmailTemplate>();
const deliveryLog: DeliveryRecord[] = [];
let _idCounter = 0;

function generateId(): string {
  return `email-${Date.now()}-${++_idCounter}`;
}

/** Register an email template. */
export function registerEmailTemplate(template: EmailTemplate): void {
  templates.set(template.id, template);
}

/** Get a registered template by ID. */
export function getEmailTemplate(id: string): EmailTemplate | undefined {
  return templates.get(id);
}

/** Render a template with variable substitution. */
export function renderEmailTemplate(
  templateId: string,
  vars: Record<string, string> = {},
): { subject: string; body: string } {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Email template not found: ${templateId}`);
  }
  let body = template.body;
  let subject = template.subject;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    body = body.replace(regex, value);
    subject = subject.replace(regex, value);
  }
  return { subject, body };
}

/** Get all delivery records. */
export function getDeliveryLog(): DeliveryRecord[] {
  return [...deliveryLog];
}

/** Get delivery record by ID. */
export function getDeliveryRecord(id: string): DeliveryRecord | undefined {
  return deliveryLog.find((r) => r.id === id);
}

/** Clear delivery log (for testing). */
export function clearDeliveryLog(): void {
  deliveryLog.length = 0;
}

/** Clear all templates (for testing). */
export function clearEmailTemplates(): void {
  templates.clear();
}

/**
 * The underlying send function — replace in tests via dependency injection.
 * Returns a messageId on success or throws on failure.
 */
export type SendFn = (to: string, subject: string, body: string) => Promise<string>;

let _sendFn: SendFn = async (to, subject) => {
  // Default no-op sender (replace with real transport in production)
  return `msg-${Date.now()}`;
};

/** Override the underlying send transport (useful for testing). */
export function setSendFunction(fn: SendFn): void {
  _sendFn = fn;
}

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an email notification with retry logic and delivery tracking.
 */
export async function sendEmailNotification(options: EmailOptions): Promise<EmailSendResult> {
  const maxRetries = options.maxRetries ?? 3;
  const deliveryId = generateId();

  // Resolve subject and body
  let subject: string;
  let body: string;

  if (options.templateId) {
    const rendered = renderEmailTemplate(options.templateId, options.templateVars ?? {});
    subject = rendered.subject;
    body = rendered.body;
  } else {
    subject = options.subject ?? '(no subject)';
    body = options.body ?? '';
  }

  // Create delivery record
  const record: DeliveryRecord = {
    id: deliveryId,
    to: options.to,
    subject,
    status: 'pending',
    attempts: 0,
  };
  deliveryLog.push(record);

  // Retry loop
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    record.attempts = attempt;
    try {
      const messageId = await _sendFn(options.to, subject, body);
      record.status = 'sent';
      record.sentAt = Date.now();
      return { success: true, messageId, deliveryId };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      record.error = lastError;
      if (attempt < maxRetries) {
        await sleep(50 * attempt); // exponential-ish backoff (short for tests)
      }
    }
  }

  record.status = 'failed';
  return { success: false, deliveryId, error: lastError };
}

/**
 * Send bulk email notifications.
 */
export async function sendBulkEmailNotifications(
  notifications: EmailOptions[],
): Promise<EmailSendResult[]> {
  const results: EmailSendResult[] = [];
  for (const notification of notifications) {
    results.push(await sendEmailNotification(notification));
  }
  return results;
}
