export const SEARCH_COLUMNS = [
  'amount',
  'status',
  'deadline',
  'creator',
  'recipients',
  'fundedPercent',
] as const;

export type SearchColumn = (typeof SEARCH_COLUMNS)[number];

export const COLUMN_LABELS: Record<SearchColumn, string> = {
  amount: 'Amount',
  status: 'Status',
  deadline: 'Deadline',
  creator: 'Creator',
  recipients: 'Recipients',
  fundedPercent: 'Funded %',
};

const STORAGE_KEY = 'stellarsplit_search_columns';

export function loadColumns(): SearchColumn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEARCH_COLUMNS];
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((c): c is SearchColumn =>
      (SEARCH_COLUMNS as readonly string[]).includes(c),
    );
    return valid.length > 0 ? valid : [...SEARCH_COLUMNS];
  } catch {
    return [...SEARCH_COLUMNS];
  }
}

export function saveColumns(columns: SearchColumn[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

export function toggleColumn(
  current: SearchColumn[],
  column: SearchColumn,
): SearchColumn[] {
  if (current.includes(column)) {
    if (current.length <= 1) return current;
    return current.filter((c) => c !== column);
  }
  return [...current, column];
}

export function isLastColumn(
  current: SearchColumn[],
  column: SearchColumn,
): boolean {
  return current.length === 1 && current[0] === column;
}
