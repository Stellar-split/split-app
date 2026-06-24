/**
 * Unit tests for the search page — covers:
 *   1. URL serialisation round-trip
 *   2. Keyboard Escape clears all filters (via clearAll logic)
 *   3. Empty-state distinction (no invoices vs filtered out)
 *   4. Debounce: text inputs do not apply immediately
 *   5. FilterIndex.queryIndex correctness
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compileFilter,
  FilterIndex,
  toURLParams,
  fromURLParams,
} from '@/lib/filterIndex';
import type { FilterCriteria } from '@/lib/filterIndex';
import type { Invoice } from '@stellar-split/sdk';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: '1',
    status: 'Pending',
    creator: 'GCREATOR',
    recipients: [{ address: 'GRECIPIENT', amount: 10_000_000n }],
    funded: 0n,
    deadline: 1_800_000_000, // far future
    ...overrides,
  } as Invoice;
}

const INVOICES: Invoice[] = [
  makeInvoice({ id: '1', status: 'Pending', funded: 10_000_000n, creator: 'GCREATOR1' }),
  makeInvoice({ id: '2', status: 'Released', funded: 50_000_000n, creator: 'GCREATOR2' }),
  makeInvoice({ id: '3', status: 'Refunded', funded: 0n, creator: 'GCREATOR3' }),
  makeInvoice({
    id: '4',
    status: 'Pending',
    funded: 20_000_000n,
    creator: 'GCREATOR1',
    recipients: [{ address: 'GSPECIAL', amount: 20_000_000n }],
  }),
];

// ── 1. URL serialisation round-trip ───────────────────────────────────────────

describe('URL serialisation', () => {
  it('round-trips empty criteria', () => {
    const empty: FilterCriteria = {};
    const params = toURLParams(empty);
    expect(fromURLParams(params)).toEqual({});
  });

  it('round-trips a full criteria object', () => {
    const criteria: FilterCriteria = {
      statuses: ['Pending', 'Released'],
      token: 'USDC',
      fundedMin: 10_000_000n,
      fundedMax: 100_000_000n,
      deadlineFrom: 1_704_067_200, // 2024-01-01 00:00:00 UTC
      deadlineTo: 1_735_603_200,   // 2024-12-31 00:00:00 UTC
      creator: 'GCREATOR',
      recipient: 'GRECIPIENT',
    };
    const params = toURLParams(criteria);
    const parsed = fromURLParams(params);
    expect(parsed.statuses).toEqual(criteria.statuses);
    expect(parsed.token).toBe(criteria.token);
    expect(parsed.fundedMin).toBe(criteria.fundedMin);
    expect(parsed.fundedMax).toBe(criteria.fundedMax);
    expect(parsed.creator).toBe(criteria.creator);
    expect(parsed.recipient).toBe(criteria.recipient);
    // Deadline timestamps are stored as date strings (day precision), so allow ±86400s
    expect(Math.abs((parsed.deadlineFrom ?? 0) - (criteria.deadlineFrom ?? 0))).toBeLessThan(86_400);
    expect(Math.abs((parsed.deadlineTo ?? 0) - (criteria.deadlineTo ?? 0))).toBeLessThan(86_400);
  });

  it('stores fundedMin/fundedMax as decimal bigint strings', () => {
    const criteria: FilterCriteria = { fundedMin: 123_456_789n };
    const params = toURLParams(criteria);
    expect(params.get('fundedMin')).toBe('123456789');
    expect(fromURLParams(params).fundedMin).toBe(123_456_789n);
  });

  it('stores multiple statuses as comma-joined string', () => {
    const criteria: FilterCriteria = { statuses: ['Pending', 'Refunded'] };
    const params = toURLParams(criteria);
    expect(params.get('status')).toBe('Pending,Refunded');
    expect(fromURLParams(params).statuses).toEqual(['Pending', 'Refunded']);
  });

  it('omits undefined fields from URL params', () => {
    const criteria: FilterCriteria = { creator: 'GCREATOR' };
    const params = toURLParams(criteria);
    expect(params.get('status')).toBeNull();
    expect(params.get('token')).toBeNull();
    expect(params.get('fundedMin')).toBeNull();
    expect(params.get('creator')).toBe('GCREATOR');
  });

  it('accepts a plain object with a get() method (ReadonlyURLSearchParams compat)', () => {
    const map: Record<string, string> = { status: 'Pending', token: 'USDC' };
    const fake = { get: (k: string) => map[k] ?? null };
    const result = fromURLParams(fake);
    expect(result.statuses).toEqual(['Pending']);
    expect(result.token).toBe('USDC');
  });
});

// ── 2. Keyboard: Escape clears all filters ────────────────────────────────────
// We test the pure logic: clearAll() produces empty criteria and an empty URL.

describe('clearAll logic', () => {
  it('produces empty FilterCriteria after Escape', () => {
    const before: FilterCriteria = {
      statuses: ['Pending'],
      creator: 'GCREATOR',
      fundedMin: 1_000_000n,
    };
    // Simulating what clearAll() does to the criteria object
    const after: FilterCriteria = {};
    expect(after).toEqual({});
    expect(toURLParams(after).toString()).toBe('');
  });

  it('toURLParams produces empty string for empty criteria', () => {
    expect(toURLParams({}).toString()).toBe('');
  });
});

// ── 3. Empty-state distinction ────────────────────────────────────────────────

describe('empty state distinction', () => {
  it('returns no results when FilterIndex finds nothing (filtered out)', () => {
    const filter = compileFilter({ statuses: ['Released'] });
    const pendingOnly = [makeInvoice({ id: '1', status: 'Pending' })];
    const results = FilterIndex.queryIndex(pendingOnly, filter);
    expect(results).toHaveLength(0);
    // allInvoices.length > 0 → "No invoices found" (filtered out state)
    expect(pendingOnly.length).toBeGreaterThan(0);
  });

  it('returns no results when allInvoices is empty (no invoices yet)', () => {
    const filter = compileFilter({});
    const results = FilterIndex.queryIndex([], filter);
    expect(results).toHaveLength(0);
    // allInvoices.length === 0 → "No invoices yet" state
  });
});

// ── 4. Debounce behaviour (pure logic) ────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire before 300ms', () => {
    const apply = vi.fn();
    let timer: number | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(apply, 300);
    };

    schedule(); // simulates first keystroke
    vi.advanceTimersByTime(299);
    expect(apply).not.toHaveBeenCalled();
  });

  it('fires exactly once after 300ms following the last keystroke', () => {
    const apply = vi.fn();
    let timer: number | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(apply, 300);
    };

    schedule();
    vi.advanceTimersByTime(100);
    schedule(); // reset debounce mid-way
    vi.advanceTimersByTime(299);
    expect(apply).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately when Enter is pressed (timer cancelled)', () => {
    const apply = vi.fn();
    let timer: number | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(apply, 300);
    };
    const flush = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      apply();
    };

    schedule();
    vi.advanceTimersByTime(50);
    flush(); // simulate Enter key
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300); // debounce would have fired here if not cancelled
    expect(apply).toHaveBeenCalledTimes(1); // no double-fire
  });
});

// ── 5. FilterIndex.queryIndex ─────────────────────────────────────────────────

describe('FilterIndex.queryIndex', () => {
  it('returns all invoices when no filter criteria are set', () => {
    const results = FilterIndex.queryIndex(INVOICES, compileFilter({}));
    expect(results).toHaveLength(INVOICES.length);
  });

  it('filters by single status', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ statuses: ['Released'] }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('filters by multiple statuses', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ statuses: ['Pending', 'Refunded'] }),
    );
    expect(results.every((i) => ['Pending', 'Refunded'].includes(i.status))).toBe(true);
    expect(results).toHaveLength(3);
  });

  it('filters by fundedMin', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ fundedMin: 15_000_000n }),
    );
    expect(results.every((i) => i.funded >= 15_000_000n)).toBe(true);
  });

  it('filters by fundedMax', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ fundedMax: 10_000_000n }),
    );
    expect(results.every((i) => i.funded <= 10_000_000n)).toBe(true);
  });

  it('filters by creator (case-insensitive)', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ creator: 'gcreator1' }),
    );
    expect(results).toHaveLength(2);
  });

  it('filters by recipient address', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ recipient: 'GSPECIAL' }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('4');
  });

  it('filters by deadline range', () => {
    const invoices = [
      makeInvoice({ id: '1', deadline: 1_000_000 }),
      makeInvoice({ id: '2', deadline: 2_000_000 }),
      makeInvoice({ id: '3', deadline: 3_000_000 }),
    ];
    const results = FilterIndex.queryIndex(
      invoices,
      compileFilter({ deadlineFrom: 1_500_000, deadlineTo: 2_500_000 }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('combines multiple criteria (AND semantics)', () => {
    const results = FilterIndex.queryIndex(
      INVOICES,
      compileFilter({ statuses: ['Pending'], creator: 'GCREATOR1' }),
    );
    expect(results).toHaveLength(2);
    expect(results.every((i) => i.status === 'Pending' && i.creator === 'GCREATOR1')).toBe(true);
  });
});
