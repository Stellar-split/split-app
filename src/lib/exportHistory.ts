export type ExportFormat = 'csv' | 'json' | 'pdf' | 'xml' | 'html' | 'custom';

export interface ExportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  [key: string]: unknown;
}

export type ExportStatus = 'pending' | 'completed' | 'failed';

export interface ExportHistoryEntry {
  id: string;
  timestamp: string;
  format: ExportFormat;
  filters: ExportFilters;
  recordCount: number;
  status: ExportStatus;
}

const STORAGE_KEY = 'payment_export_history';
const SCHEDULE_STORAGE_KEY = 'invoice_export_schedule';

export interface ScheduledInvoiceExport {
  id: string;
  invoiceId: string;
  format: ExportFormat;
  scheduledAt: string;
  status: 'pending' | 'completed';
  content: string;
  mimeType: string;
  extension: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isValidEntry(value: unknown): value is ExportHistoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.timestamp === 'string' &&
    typeof entry.format === 'string' &&
    typeof entry.recordCount === 'number' &&
    typeof entry.status === 'string' &&
    typeof entry.filters === 'object' &&
    entry.filters !== null
  );
}

export function getExportHistory(): ExportHistoryEntry[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

function persist(entries: ExportHistoryEntry[]): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors (quota exceeded, privacy mode, etc.)
  }
}

export function addExportHistoryEntry(
  entry: Omit<ExportHistoryEntry, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): ExportHistoryEntry {
  const fullEntry: ExportHistoryEntry = {
    id: entry.id ?? generateId(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    format: entry.format,
    filters: entry.filters ?? {},
    recordCount: entry.recordCount,
    status: entry.status,
  };

  const history = getExportHistory();
  history.push(fullEntry);
  persist(history);

  return fullEntry;
}

export function clearExportHistory(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function getScheduledInvoiceExports(): ScheduledInvoiceExport[] {
  if (!isBrowser()) return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SCHEDULE_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ScheduledInvoiceExport =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' && typeof item.invoiceId === 'string' &&
      typeof item.scheduledAt === 'string' && typeof item.content === 'string' &&
      typeof item.mimeType === 'string' && typeof item.extension === 'string' &&
      (item.status === 'pending' || item.status === 'completed')
    );
  } catch {
    return [];
  }
}

export function scheduleInvoiceExport(
  job: Omit<ScheduledInvoiceExport, 'id' | 'status'>
): ScheduledInvoiceExport {
  const scheduled: ScheduledInvoiceExport = {
    ...job,
    id: generateId(),
    status: 'pending',
  };
  const jobs = getScheduledInvoiceExports();
  jobs.push(scheduled);
  try {
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    throw new Error('Unable to save scheduled export in browser storage.');
  }
  return scheduled;
}

export function completeScheduledInvoiceExport(id: string): void {
  const jobs = getScheduledInvoiceExports().map((job) =>
    job.id === id ? { ...job, status: 'completed' as const } : job
  );
  try {
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // The downloaded export is still complete if history persistence fails.
  }
}