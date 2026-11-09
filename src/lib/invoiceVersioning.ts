import { randomUUID } from 'crypto';

export type InvoiceStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';

export interface InvoiceRecipient {
  id: string;
  name: string;
  email?: string;
  amount?: number;
}

export interface InvoiceSnapshot {
  id: string;
  amount: number;
  currency?: string;
  recipients: InvoiceRecipient[];
  deadline?: string | null;
  notes?: string | null;
  status: InvoiceStatus;
}

export type InvoiceField = 'amount' | 'recipients' | 'deadline' | 'notes' | 'status';

export interface FieldDiff<T = unknown> {
  field: InvoiceField;
  before: T;
  after: T;
}

export interface InvoiceDiff {
  fields: FieldDiff[];
  hasChanges: boolean;
}

export interface AmendmentReason {
  code: string;
  label: string;
}

export interface Amendment {
  reason: AmendmentReason;
  comment?: string;
  amendedBy: string;
  amendedAt: string;
}

export interface InvoiceVersion {
  versionId: string;
  invoiceId: string;
  versionNumber: number;
  snapshot: InvoiceSnapshot;
  amendment: Amendment;
  diff: InvoiceDiff;
  createdAt: string;
  createdBy: string;
}

export interface VersionTimelineEntry {
  versionId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  reason: AmendmentReason;
  comment?: string;
  changedFields: InvoiceField[];
  summary: string;
}

const TRACKED_FIELDS: InvoiceField[] = ['amount', 'recipients', 'deadline', 'notes', 'status'];

function normalizeRecipients(recipients: InvoiceRecipient[] | undefined): InvoiceRecipient[] {
  if (!recipients) return [];
  return [...recipients]
    .map((r) => ({ ...r }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function recipientsEqual(a: InvoiceRecipient[], b: InvoiceRecipient[]): boolean {
  const na = normalizeRecipients(a);
  const nb = normalizeRecipients(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    const ra = na[i];
    const rb = nb[i];
    if (
      ra.id !== rb.id ||
      ra.name !== rb.name ||
      (ra.email ?? null) !== (rb.email ?? null) ||
      (ra.amount ?? null) !== (rb.amount ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function valuesEqual(field: InvoiceField, a: unknown, b: unknown): boolean {
  if (field === 'recipients') {
    return recipientsEqual(
      (a as InvoiceRecipient[]) ?? [],
      (b as InvoiceRecipient[]) ?? [],
    );
  }
  if (field === 'amount') {
    return Number(a ?? 0) === Number(b ?? 0);
  }
  if (field === 'deadline' || field === 'notes') {
    return (a ?? null) === (b ?? null);
  }
  return a === b;
}

function cloneSnapshot(snapshot: InvoiceSnapshot): InvoiceSnapshot {
  return {
    ...snapshot,
    recipients: normalizeRecipients(snapshot.recipients),
  };
}

/**
 * Calculate a field-level diff between two invoice snapshots.
 */
export function calculateDiff(
  before: InvoiceSnapshot,
  after: InvoiceSnapshot,
): InvoiceDiff {
  const fields: FieldDiff[] = [];
  for (const field of TRACKED_FIELDS) {
    const beforeValue = (before as unknown as Record<string, unknown>)[field];
    const afterValue = (after as unknown as Record<string, unknown>)[field];
    if (!valuesEqual(field, beforeValue, afterValue)) {
      fields.push({
        field,
        before: field === 'recipients' ? normalizeRecipients(beforeValue as InvoiceRecipient[]) : beforeValue,
        after: field === 'recipients' ? normalizeRecipients(afterValue as InvoiceRecipient[]) : afterValue,
      });
    }
  }
  return { fields, hasChanges: fields.length > 0 };
}

export interface RecordVersionInput {
  invoiceId: string;
  previousSnapshot?: InvoiceSnapshot | null;
  newSnapshot: InvoiceSnapshot;
  reason: AmendmentReason;
  comment?: string;
  amendedBy: string;
  amendedAt?: string;
}

/**
 * Record a new invoice version, computing the diff against the previous snapshot.
 * Returns the created version along with the updated history.
 */
export function recordVersion(
  history: InvoiceVersion[],
  input: RecordVersionInput,
): { version: InvoiceVersion; history: InvoiceVersion[] } {
  const existing = history.filter((v) => v.invoiceId === input.invoiceId);
  const versionNumber = existing.length + 1;
  const amendedAt = input.amendedAt ?? new Date().toISOString();

  const previousSnapshot = input.previousSnapshot ?? null;
  const diff = previousSnapshot
    ? calculateDiff(previousSnapshot, input.newSnapshot)
    : calculateDiff(
        {
          id: input.newSnapshot.id,
          amount: 0,
          recipients: [],
          deadline: null,
          notes: null,
          status: 'draft',
        },
        input.newSnapshot,
      );

  const version: InvoiceVersion = {
    versionId: randomUUID(),
    invoiceId: input.invoiceId,
    versionNumber,
    snapshot: cloneSnapshot(input.newSnapshot),
    amendment: {
      reason: input.reason,
      comment: input.comment,
      amendedBy: input.amendedBy,
      amendedAt,
    },
    diff,
    createdAt: amendedAt,
    createdBy: input.amendedBy,
  };

  return { version, history: [...history, version] };
}

/**
 * Retrieve the version history for a given invoice, ordered by version number.
 */
export function getVersionHistory(
  history: InvoiceVersion[],
  invoiceId: string,
): InvoiceVersion[] {
  return history
    .filter((v) => v.invoiceId === invoiceId)
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

/**
 * Retrieve a specific version by id.
 */
export function getVersionById(
  history: InvoiceVersion[],
  versionId: string,
): InvoiceVersion | undefined {
  return history.find((v) => v.versionId === versionId);
}

/**
 * Retrieve the latest version for an invoice.
 */
export function getLatestVersion(
  history: InvoiceVersion[],
  invoiceId: string,
): InvoiceVersion | undefined {
  const versions = getVersionHistory(history, invoiceId);
  return versions.length ? versions[versions.length - 1] : undefined;
}

function buildSummary(version: InvoiceVersion): string {
  const { fields } = version.diff;
  if (fields.length === 0) {
    return `Version ${version.versionNumber} created (no field changes)`;
  }
  const names = fields.map((f) => f.field).join(', ');
  return `Version ${version.versionNumber}: changed ${names}`;
}

/**
 * Produce a timeline-friendly list of versions for an invoice.
 */
export function getVersionTimeline(
  history: InvoiceVersion[],
  invoiceId: string,
): VersionTimelineEntry[] {
  return getVersionHistory(history, invoiceId).map((version) => ({
    versionId: version.versionId,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    reason: version.amendment.reason,
    comment: version.amendment.comment,
    changedFields: version.diff.fields.map((f) => f.field),
    summary: buildSummary(version),
  }));
}

export interface AmendmentNotification {
  invoiceId: string;
  versionId: string;
  versionNumber: number;
  reason: AmendmentReason;
  comment?: string;
  amendedBy: string;
  amendedAt: string;
  changedFields: InvoiceField[];
  recipients: InvoiceRecipient[];
}

export interface InvoiceVersionDiff {
  field: InvoiceField;
  before: unknown;
  after: unknown;
}

/**
 * Build notifications for parties affected by an amendment.
 */
export function buildAmendmentNotifications(
  version: InvoiceVersion,
): AmendmentNotification[] {
  const recipients = version.snapshot.recipients ?? [];
  if (recipients.length === 0) return [];
  return recipients.map((recipient) => ({
    invoiceId: version.invoiceId,
    versionId: version.versionId,
    versionNumber: version.versionNumber,
    reason: version.amendment.reason,
    comment: version.amendment.comment,
    amendedBy: version.amendment.amendedBy,
    amendedAt: version.amendment.amendedAt,
    changedFields: version.diff.fields.map((f) => f.field),
    recipients: [recipient],
  }));
}

/**
 * Fetch all versions for an invoice.
 */
export async function getInvoiceVersions(
  invoiceId: string,
): Promise<InvoiceVersion[]> {
  // This is a stub - in a real implementation, this would fetch from a store or API
  return [];
}

/**
 * Get versions from a local history array.
 */
export function getInvoiceVersionsSync(
  history: InvoiceVersion[],
  invoiceId: string,
): InvoiceVersion[] {
  return getVersionHistory(history, invoiceId);
}

/**
 * Send notifications for parties affected by an amendment.
 */
export async function notifyAffectedParties(
  invoiceId: string,
  details: {
    action: string;
    versionNumber?: number;
    reason?: string;
    comment?: string;
    diff?: unknown;
  },
): Promise<void> {
  // This is a stub - in a real implementation, this would send notifications
}