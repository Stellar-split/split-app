import { describe, it, expect } from 'vitest';

// Helper to safely compare values including BigInt
function areValuesDifferent(value1: any, value2: any): boolean {
  const serialize = (val: any) =>
    JSON.stringify(val, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  return serialize(value1) !== serialize(value2);
}

// Mocking invoiceDiff implementation for demonstration based on the test suite structure
function invoiceDiff(invoice1: any, invoice2: any) {
  const diffs: Record<string, { value1: any; value2: any }> = {};
  const keys = new Set([...Object.keys(invoice1), ...Object.keys(invoice2)]);

  for (const key of keys) {
    const value1 = invoice1[key];
    const value2 = invoice2[key];
    
    if (areValuesDifferent(value1, value2)) {
      diffs[key] = { value1, value2 };
    }
  }

  return {
    diffs,
    hasDifferences: Object.keys(diffs).length > 0,
  };
}

describe('invoiceMergeTool', () => {
  describe('invoiceDiff utility', () => {
    it('correctly identifies identical invoices', () => {
      const inv1 = { id: '1', amount: 100n, status: 'PENDING' };
      const inv2 = { id: '1', amount: 100n, status: 'PENDING' };
      const result = invoiceDiff(inv1, inv2);
      expect(result.hasDifferences).toBe(false);
    });

    it('correctly identifies differences in single fields', () => {
      const inv1 = { id: '1', amount: 100n, status: 'PENDING' };
      const inv2 = { id: '1', amount: 200n, status: 'PENDING' };
      const result = invoiceDiff(inv1, inv2);
      expect(result.hasDifferences).toBe(true);
      expect(result.diffs.amount).toEqual({ value1: 100n, value2: 200n });
    });
  });
});
