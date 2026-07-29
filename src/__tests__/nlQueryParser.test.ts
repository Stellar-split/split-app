import { parseNaturalLanguageQuery, applyParsedFilters } from '@/lib/nlQueryParser';
import { describe, it, expect } from 'vitest';

describe('nlQueryParser', () => {
  describe('parseNaturalLanguageQuery', () => {
    it('should parse "unpaid invoices over 200 XLM from last month"', () => {
      const result = parseNaturalLanguageQuery('unpaid invoices over 200 XLM from last month');
      expect(result.filters.status).toBe('pending');
      expect(result.filters.amountGte).toBe(200);
      expect(result.filters.dueDateFrom).toBeDefined();
      expect(result.filters.dueDateTo).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    it('should parse amount ranges', () => {
      const result = parseNaturalLanguageQuery('invoices between 100 and 500 XLM');
      expect(result.filters.amountGte).toBe(100);
      expect(result.filters.amountLte).toBe(500);
      expect(result.tokens.some((t) => t.type === 'amount_range')).toBe(true);
    });

    it('should parse minimum amount', () => {
      const result = parseNaturalLanguageQuery('over 500 XLM');
      expect(result.filters.amountGte).toBe(500);
    });

    it('should parse maximum amount', () => {
      const result = parseNaturalLanguageQuery('under 1000 XLM');
      expect(result.filters.amountLte).toBe(1000);
    });

    it('should parse status keywords', () => {
      expect(parseNaturalLanguageQuery('unpaid').filters.status).toBe('pending');
      expect(parseNaturalLanguageQuery('paid').filters.status).toBe('paid');
      expect(parseNaturalLanguageQuery('overdue').filters.status).toBe('overdue');
      expect(parseNaturalLanguageQuery('draft').filters.status).toBe('draft');
    });

    it('should parse relative dates', () => {
      const result = parseNaturalLanguageQuery('this week');
      expect(result.filters.dueDateFrom).toBeDefined();
      expect(result.filters.dueDateTo).toBeDefined();
    });

    it('should parse "past N days"', () => {
      const result = parseNaturalLanguageQuery('past 7 days');
      expect(result.filters.dueDateFrom).toBeDefined();
      expect(result.filters.dueDateTo).toBeDefined();
    });

    it('should parse asset names', () => {
      expect(parseNaturalLanguageQuery('XLM').filters.asset).toBe('XLM');
      expect(parseNaturalLanguageQuery('USDC').filters.asset).toBe('USDC');
    });

    it('should handle mixed case', () => {
      const result = parseNaturalLanguageQuery('UNPAID Invoices OVER 200 xlm');
      expect(result.filters.status).toBe('pending');
      expect(result.filters.amountGte).toBe(200);
    });

    it('should handle typos gracefully (with keyword fallback)', () => {
      const result = parseNaturalLanguageQuery('invoces for customer A');
      expect(result.filters.titleKeyword).toBeDefined();
    });

    it('should handle complex query with multiple constraints', () => {
      const result = parseNaturalLanguageQuery(
        'unpaid invoices between 100 and 500 XLM in USDC status from last week'
      );
      expect(result.filters.status).toBe('pending');
      expect(result.filters.amountGte).toBe(100);
      expect(result.filters.amountLte).toBe(500);
      expect(result.filters.dueDateFrom).toBeDefined();
    });

    it('should generate filter tokens', () => {
      const result = parseNaturalLanguageQuery('paid invoices over 300 XLM this month');
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.tokens.some((t) => t.type === 'status')).toBe(true);
      expect(result.tokens.some((t) => t.type === 'amount_min')).toBe(true);
    });

    it('should handle empty query', () => {
      const result = parseNaturalLanguageQuery('');
      expect(result.filters).toEqual({});
      expect(result.tokens.length).toBe(0);
    });

    it('should handle query with only whitespace', () => {
      const result = parseNaturalLanguageQuery('   ');
      expect(result.tokens.length).toBe(0);
    });
  });

  describe('applyParsedFilters', () => {
    const mockInvoices = [
      {
        id: '1',
        title: 'Invoice 1',
        amount: 150,
        status: 'pending',
        recipients: [{ address: 'customer1@example.com' }],
      },
      {
        id: '2',
        title: 'Invoice 2',
        amount: 300,
        status: 'paid',
        recipients: [{ address: 'customer2@example.com' }],
      },
      {
        id: '3',
        title: 'Invoice 3',
        amount: 600,
        status: 'overdue',
        recipients: [{ address: 'customer3@example.com' }],
      },
    ];

    it('should filter by amount minimum', () => {
      const result = applyParsedFilters(mockInvoices, { amountGte: 300 });
      expect(result.length).toBe(2);
      expect(result.map((i) => i.id)).toEqual(['2', '3']);
    });

    it('should filter by amount maximum', () => {
      const result = applyParsedFilters(mockInvoices, { amountLte: 300 });
      expect(result.length).toBe(2);
      expect(result.map((i) => i.id)).toEqual(['1', '2']);
    });

    it('should filter by amount range', () => {
      const result = applyParsedFilters(mockInvoices, {
        amountGte: 200,
        amountLte: 500,
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('should filter by status', () => {
      const result = applyParsedFilters(mockInvoices, { status: 'paid' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('should filter by keyword', () => {
      const result = applyParsedFilters(mockInvoices, {
        titleKeyword: 'customer1',
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('should combine multiple filters', () => {
      const result = applyParsedFilters(mockInvoices, {
        status: 'paid',
        amountGte: 250,
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });
  });
});
