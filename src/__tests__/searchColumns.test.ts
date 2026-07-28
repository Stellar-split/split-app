const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import {
  SEARCH_COLUMNS,
  loadColumns,
  saveColumns,
  toggleColumn,
  isLastColumn,
  type SearchColumn,
} from '@/lib/searchColumns';

beforeEach(() => {
  localStorageMock.clear();
});

describe('toggleColumn', () => {
  test('removes a column when it is currently visible', () => {
    const cols: SearchColumn[] = ['amount', 'status', 'deadline'];
    const result = toggleColumn(cols, 'status');
    expect(result).toEqual(['amount', 'deadline']);
  });

  test('adds a column when it is not currently visible', () => {
    const cols: SearchColumn[] = ['amount'];
    const result = toggleColumn(cols, 'deadline');
    expect(result).toEqual(['amount', 'deadline']);
  });

  test('prevents deselecting the last visible column', () => {
    const cols: SearchColumn[] = ['amount'];
    const result = toggleColumn(cols, 'amount');
    expect(result).toEqual(['amount']);
  });
});

describe('isLastColumn', () => {
  test('returns true when only one column matches', () => {
    expect(isLastColumn(['status'], 'status')).toBe(true);
  });

  test('returns false when multiple columns exist', () => {
    expect(isLastColumn(['status', 'amount'], 'status')).toBe(false);
  });

  test('returns false when the single column does not match', () => {
    expect(isLastColumn(['amount'], 'status')).toBe(false);
  });
});

describe('persistence round-trip', () => {
  test('saveColumns then loadColumns returns the same column set', () => {
    const cols: SearchColumn[] = ['status', 'deadline', 'fundedPercent'];
    saveColumns(cols);
    const loaded = loadColumns();
    expect(loaded).toEqual(cols);
  });

  test('loadColumns returns all columns when storage is empty', () => {
    const loaded = loadColumns();
    expect(loaded).toEqual([...SEARCH_COLUMNS]);
  });

  test('loadColumns returns all columns when storage contains invalid JSON', () => {
    localStorageMock.setItem('stellarsplit_search_columns', 'not-json');
    const loaded = loadColumns();
    expect(loaded).toEqual([...SEARCH_COLUMNS]);
  });

  test('loadColumns filters out invalid column names', () => {
    localStorageMock.setItem(
      'stellarsplit_search_columns',
      JSON.stringify(['amount', 'bogus', 'status']),
    );
    const loaded = loadColumns();
    expect(loaded).toEqual(['amount', 'status']);
  });

  test('loadColumns returns all columns when all stored values are invalid', () => {
    localStorageMock.setItem(
      'stellarsplit_search_columns',
      JSON.stringify(['bogus', 'invalid']),
    );
    const loaded = loadColumns();
    expect(loaded).toEqual([...SEARCH_COLUMNS]);
  });
});
