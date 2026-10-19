import {
  validateRecurringSchedule,
  detectScheduleConflicts,
  computeNextRun,
  pauseSchedule,
  resumeSchedule,
  cancelSchedule,
  type RecurringSchedule,
  type ScheduleStatus,
} from '../recurring';

import {
  convertAmount,
  isRateLockValid,
  recordCurrencyHistory,
  getCurrencyHistory,
  type ExchangeRate,
  type RateLock,
  type CurrencyHistoryEntry,
} from '../currency';

import {
  validateBundle,
  transitionBundleStatus,
  aggregateBundle,
  type InvoiceBundle,
  type BundleStatus,
  type BundleItem,
} from '../bundle';

describe('Recurring schedule validation', () => {
  const baseSchedule: RecurringSchedule = {
    id: 'sched-1',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2024-12-31T00:00:00Z'),
    amount: 100,
    currency: 'XLM',
    status: 'active',
  };

  it('accepts a valid monthly schedule', () => {
    const result = validateRecurringSchedule(baseSchedule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts daily, weekly, and custom interval schedules', () => {
    expect(
      validateRecurringSchedule({ ...baseSchedule, frequency: 'daily', interval: 1 }).valid,
    ).toBe(true);
    expect(
      validateRecurringSchedule({ ...baseSchedule, frequency: 'weekly', interval: 2 }).valid,
    ).toBe(true);
    expect(
      validateRecurringSchedule({ ...baseSchedule, frequency: 'custom', interval: 3 }).valid,
    ).toBe(true);
  });

  it('rejects an interval less than 1', () => {
    const result = validateRecurringSchedule({ ...baseSchedule, interval: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('interval must be at least 1');
  });

  it('rejects a non-positive amount', () => {
    const result = validateRecurringSchedule({ ...baseSchedule, amount: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('amount must be greater than 0');
  });

  it('rejects an end date before the start date', () => {
    const result = validateRecurringSchedule({
      ...baseSchedule,
      endDate: new Date('2023-12-31T00:00:00Z'),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('endDate must be after startDate');
  });

  it('rejects an unsupported frequency', () => {
    const result = validateRecurringSchedule({
      ...baseSchedule,
      frequency: 'yearly' as RecurringSchedule['frequency'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unsupported frequency');
  });
});

describe('Schedule conflict detection', () => {
  const existing: RecurringSchedule = {
    id: 'sched-1',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2024-06-30T00:00:00Z'),
    amount: 100,
    currency: 'XLM',
    status: 'active',
  };

  it('detects overlapping schedules for the same currency', () => {
    const candidate: RecurringSchedule = {
      ...existing,
      id: 'sched-2',
      startDate: new Date('2024-03-01T00:00:00Z'),
      endDate: new Date('2024-09-30T00:00:00Z'),
    };
    const conflicts = detectScheduleConflicts(candidate, [existing]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('sched-1');
  });

  it('does not flag non-overlapping schedules', () => {
    const candidate: RecurringSchedule = {
      ...existing,
      id: 'sched-2',
      startDate: new Date('2024-07-01T00:00:00Z'),
      endDate: new Date('2024-12-31T00:00:00Z'),
    };
    expect(detectScheduleConflicts(candidate, [existing])).toHaveLength(0);
  });

  it('ignores cancelled schedules when detecting conflicts', () => {
    const cancelled: RecurringSchedule = { ...existing, status: 'cancelled' };
    const candidate: RecurringSchedule = {
      ...existing,
      id: 'sched-2',
      startDate: new Date('2024-02-01T00:00:00Z'),
      endDate: new Date('2024-05-01T00:00:00Z'),
    };
    expect(detectScheduleConflicts(candidate, [cancelled])).toHaveLength(0);
  });

  it('ignores the schedule itself when checking conflicts', () => {
    expect(detectScheduleConflicts(existing, [existing])).toHaveLength(0);
  });
});

describe('Next run computation', () => {
  it('computes the next daily run', () => {
    const schedule: RecurringSchedule = {
      id: 's1',
      frequency: 'daily',
      interval: 1,
      startDate: new Date('2024-01-01T00:00:00Z'),
      amount: 10,
      currency: 'XLM',
      status: 'active',
    };
    const next = computeNextRun(schedule, new Date('2024-01-01T00:00:00Z'));
    expect(next?.toISOString()).toBe('2024-01-02T00:00:00.000Z');
  });

  it('computes the next weekly run with interval', () => {
    const schedule: RecurringSchedule = {
      id: 's1',
      frequency: 'weekly',
      interval: 2,
      startDate: new Date('2024-01-01T00:00:00Z'),
      amount: 10,
      currency: 'XLM',
      status: 'active',
    };
    const next = computeNextRun(schedule, new Date('2024-01-01T00:00:00Z'));
    expect(next?.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('computes the next monthly run', () => {
    const schedule: RecurringSchedule = {
      id: 's1',
      frequency: 'monthly',
      interval: 1,
      startDate: new Date('2024-01-01T00:00:00Z'),
      amount: 10,
      currency: 'XLM',
      status: 'active',
    };
    const next = computeNextRun(schedule, new Date('2024-01-01T00:00:00Z'));
    expect(next?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
  });

  it('returns null when the next run exceeds the end date', () => {
    const schedule: RecurringSchedule = {
      id: 's1',
      frequency: 'monthly',
      interval: 1,
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-01-15T00:00:00Z'),
      amount: 10,
      currency: 'XLM',
      status: 'active',
    };
    expect(computeNextRun(schedule, new Date('2024-01-01T00:00:00Z'))).toBeNull();
  });

  it('returns null for non-active schedules', () => {
    const schedule: RecurringSchedule = {
      id: 's1',
      frequency: 'daily',
      interval: 1,
      startDate: new Date('2024-01-01T00:00:00Z'),
      amount: 10,
      currency: 'XLM',
      status: 'paused',
    };
    expect(computeNextRun(schedule, new Date('2024-01-01T00:00:00Z'))).toBeNull();
  });
});

describe('Schedule status transitions', () => {
  const active: RecurringSchedule = {
    id: 's1',
    frequency: 'monthly',
    interval: 1,
    startDate: new Date('2024-01-01T00:00:00Z'),
    amount: 10,
    currency: 'XLM',
    status: 'active',
  };

  it('pauses an active schedule', () => {
    const paused = pauseSchedule(active);
    expect(paused.status).toBe<ScheduleStatus>('paused');
  });

  it('resumes a paused schedule', () => {
    const paused = pauseSchedule(active);
    const resumed = resumeSchedule(paused);
    expect(resumed.status).toBe<ScheduleStatus>('active');
  });

  it('cancels an active schedule', () => {
    const cancelled = cancelSchedule(active);
    expect(cancelled.status).toBe<ScheduleStatus>('cancelled');
  });

  it('does not resume a cancelled schedule', () => {
    const cancelled = cancelSchedule(active);
    const resumed = resumeSchedule(cancelled);
    expect(resumed.status).toBe<ScheduleStatus>('cancelled');
  });

  it('does not pause a cancelled schedule', () => {
    const cancelled = cancelSchedule(active);
    const paused = pauseSchedule(cancelled);
    expect(paused.status).toBe<ScheduleStatus>('cancelled');
  });
});

describe('Currency conversion', () => {
  const rate: ExchangeRate = {
    from: 'USD',
    to: 'XLM',
    rate: 10,
    timestamp: new Date('2024-01-01T00:00:00Z'),
  };

  it('converts an amount using the exchange rate', () => {
    expect(convertAmount(100, rate)).toBe(1000);
  });

  it('returns 0 for a zero amount', () => {
    expect(convertAmount(0, rate)).toBe(0);
  });

  it('throws for a negative amount', () => {
    expect(() => convertAmount(-1, rate)).toThrow();
  });

  it('throws for a non-positive rate', () => {
    expect(() => convertAmount(100, { ...rate, rate: 0 })).toThrow();
  });
});

describe('Rate lock expiry', () => {
  const lock: RateLock = {
    id: 'lock-1',
    rate: { from: 'USD', to: 'XLM', rate: 10, timestamp: new Date('2024-01-01T00:00:00Z') },
    lockedAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: new Date('2024-01-01T00:15:00Z'),
  };

  it('is valid before expiry', () => {
    expect(isRateLockValid(lock, new Date('2024-01-01T00:10:00Z'))).toBe(true);
  });

  it('is invalid at expiry', () => {
    expect(isRateLockValid(lock, new Date('2024-01-01T00:15:00Z'))).toBe(false);
  });

  it('is invalid after expiry', () => {
    expect(isRateLockValid(lock, new Date('2024-01-01T00:20:00Z'))).toBe(false);
  });
});

describe('Currency history recording', () => {
  beforeEach(() => {
    // Reset history between tests by recording into a fresh store
    // (getCurrencyHistory returns a copy, so we verify via recording + reading)
  });

  it('records and retrieves currency history entries', () => {
    const entry: CurrencyHistoryEntry = {
      id: 'hist-1',
      invoiceId: 'inv-1',
      from: 'USD',
      to: 'XLM',
      amount: 100,
      convertedAmount: 1000,
      rate: 10,
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };
    recordCurrencyHistory(entry);
    const history = getCurrencyHistory('inv-1');
    expect(history.some((h) => h.id === 'hist-1')).toBe(true);
  });

  it('returns an empty array for unknown invoices', () => {
    expect(getCurrencyHistory('unknown-invoice')).toEqual([]);
  });
});

describe('Bundle validation', () => {
  const items: BundleItem[] = [
    { invoiceId: 'inv-1', amount: 100, currency: 'XLM' },
    { invoiceId: 'inv-2', amount: 200, currency: 'XLM' },
  ];

  const bundle: InvoiceBundle = {
    id: 'bundle-1',
    name: 'Q1 Invoices',
    items,
    status: 'draft',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('accepts a valid bundle', () => {
    const result = validateBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an empty bundle', () => {
    const result = validateBundle({ ...bundle, items: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('bundle must contain at least one invoice');
  });

  it('rejects duplicate invoice ids', () => {
    const result = validateBundle({
      ...bundle,
      items: [items[0], items[0]],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('bundle contains duplicate invoices');
  });

  it('rejects items with non-positive amounts', () => {
    const result = validateBundle({
      ...bundle,
      items: [{ invoiceId: 'inv-1', amount: 0, currency: 'XLM' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invoice amounts must be greater than 0');
  });

  it('rejects mixed currencies', () => {
    const result = validateBundle({
      ...bundle,
      items: [
        { invoiceId: 'inv-1', amount: 100, currency: 'XLM' },
        { invoiceId: 'inv-2', amount: 200, currency: 'USD' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('bundle items must share the same currency');
  });
});

describe('Bundle status transitions', () => {
  const bundle: InvoiceBundle = {
    id: 'bundle-1',
    name: 'Q1 Invoices',
    items: [{ invoiceId: 'inv-1', amount: 100, currency: 'XLM' }],
    status: 'draft',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('transitions draft to sent', () => {
    const next = transitionBundleStatus(bundle, 'sent');
    expect(next.status).toBe<BundleStatus>('sent');
  });

  it('transitions sent to paid', () => {
    const sent = transitionBundleStatus(bundle, 'sent');
    const paid = transitionBundleStatus(sent, 'paid');
    expect(paid.status).toBe<BundleStatus>('paid');
  });

  it('transitions sent to cancelled', () => {
    const sent = transitionBundleStatus(bundle, 'sent');
    const cancelled = transitionBundleStatus(sent, 'cancelled');
    expect(cancelled.status).toBe<BundleStatus>('cancelled');
  });

  it('rejects invalid transitions', () => {
    expect(() => transitionBundleStatus(bundle, 'paid')).toThrow();
  });

  it('rejects transitions from a terminal state', () => {
    const paid = transitionBundleStatus(transitionBundleStatus(bundle, 'sent'), 'paid');
    expect(() => transitionBundleStatus(paid, 'cancelled')).toThrow();
  });
});

describe('Bundle aggregation', () => {
  it('aggregates totals and counts', () => {
    const bundle: InvoiceBundle = {
      id: 'bundle-1',
      name: 'Q1 Invoices',
      items: [
        { invoiceId: 'inv-1', amount: 100, currency: 'XLM' },
        { invoiceId: 'inv-2', amount: 200, currency: 'XLM' },
        { invoiceId: 'inv-3', amount: 300, currency: 'XLM' },
      ],
      status: 'sent',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    const summary = aggregateBundle(bundle);
    expect(summary.totalAmount).toBe(600);
    expect(summary.itemCount).toBe(3);
    expect(summary.currency).toBe('XLM');
  });

  it('returns zero totals for an empty bundle', () => {
    const bundle: InvoiceBundle = {
      id: 'bundle-empty',
      name: 'Empty',
      items: [],
      status: 'draft',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    const summary = aggregateBundle(bundle);
    expect(summary.totalAmount).toBe(0);
    expect(summary.itemCount).toBe(0);
  });
});