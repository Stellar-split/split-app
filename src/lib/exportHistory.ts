export type ExportFormat = 'csv' | 'json' | 'pdf';

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