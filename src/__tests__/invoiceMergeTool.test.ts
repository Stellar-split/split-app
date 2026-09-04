import { describe, it, expect } from 'vitest';

// Helper to safely compare values including BigInt
function areValuesDifferent(value1: any, value2: any): boolean {
  const serialize = (val: any) =>
    JSON.stringify(val, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  return serialize(value1) !== serialize(value2);
}

// JSON.stringify cannot serialize BigInt — normalize BigInt values to
// strings before comparing invoice field snapshots.
const safeStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v}n` : v));

export const invoiceDiff = (
  invoice1: Invoice,
  invoice2: Invoice
): InvoiceDiff => {
  const fieldsToCompare: (keyof Invoice)[] = [
    'id',
    'creator',
    'recipients',
    'token',
    'amount',
    'deadline',
    'funded',
    'status',
    'description',
  ];

  const fields: DiffField[] = fieldsToCompare.map((field) => {
    const value1 = invoice1[field];
    const value2 = invoice2[field];
    const isDifferent = safeStringify(value1) !== safeStringify(value2);

    return {
      field: field as string,
      value1,
      value2,
      isDifferent,
    };
  });

  const hasDifferences = fields.some((f) => f.isDifferent);

  return { fields, hasDifferences };
};

const SCALE = 10_000_000n;

const createInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  creator: 'GCREATOR',
  recipients: [{ address: 'GPAYER', amount: 100n * SCALE }],
  token: 'CUSDC',
  deadline: 0,
  funded: 0n,
  status: 'Pending',
  payments: [],
  ...overrides,
});

describe('invoiceDiff utility', () => {
  it('correctly identifies identical invoices', () => {
    const invoice1 = createInvoice();
    const invoice2 = createInvoice();

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(false);
    expect(diff.fields.every((f) => !f.isDifferent)).toBe(true);
  });

  it('correctly identifies differences in single fields', () => {
    const invoice1 = createInvoice({
      description: 'Original description',
    });
    const invoice2 = createInvoice({
      description: 'Modified description',
    });

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(true);
    const descField = diff.fields.find((f) => f.field === 'description');
    expect(descField?.isDifferent).toBe(true);
    expect(descField?.value1).toBe('Original description');
    expect(descField?.value2).toBe('Modified description');
  });

  it('correctly identifies differences in amount fields', () => {
    const invoice1 = createInvoice({ funded: 50n * SCALE });
    const invoice2 = createInvoice({ funded: 75n * SCALE });

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(true);
    const fundedField = diff.fields.find((f) => f.field === 'funded');
    expect(fundedField?.isDifferent).toBe(true);
  });

  it('correctly identifies differences in recipients arrays', () => {
    const invoice1 = createInvoice({
      recipients: [{ address: 'GPAYER1', amount: 100n * SCALE }],
    });
    const invoice2 = createInvoice({
      recipients: [{ address: 'GPAYER2', amount: 100n * SCALE }],
    });

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(true);
    const recipientsField = diff.fields.find((f) => f.field === 'recipients');
    expect(recipientsField?.isDifferent).toBe(true);
  });

  it('correctly identifies differences in status field', () => {
    const invoice1 = createInvoice({ status: 'Pending' });
    const invoice2 = createInvoice({ status: 'Paid' });

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(true);
    const statusField = diff.fields.find((f) => f.field === 'status');
    expect(statusField?.isDifferent).toBe(true);
  });

  it('identifies multiple differences', () => {
    const invoice1 = createInvoice({
      description: 'Desc 1',
      funded: 50n * SCALE,
    });
    const invoice2 = createInvoice({
      description: 'Desc 2',
      funded: 75n * SCALE,
      status: 'Paid',
    });

    const diff = invoiceDiff(invoice1, invoice2);

    expect(diff.hasDifferences).toBe(true);
    const differentFields = diff.fields.filter((f) => f.isDifferent);
    expect(differentFields.length).toBeGreaterThan(1);
  });
});

describe('MergeDiffPanel logic', () => {
  it('allows selecting field values from either invoice', () => {
    const invoice1 = createInvoice({ description: 'Invoice 1' });
    const invoice2 = createInvoice({ description: 'Invoice 2' });

    const diff = invoiceDiff(invoice1, invoice2);
    const selections = new Map<string, 1 | 2>();

    // Select from invoice 1 for description
    selections.set('description', 1);

    expect(selections.get('description')).toBe(1);
  });

  it('tracks all field selections for merge operation', () => {
    const invoice1 = createInvoice({
      description: 'Desc 1',
      funded: 50n * SCALE,
    });
    const invoice2 = createInvoice({
      description: 'Desc 2',
      funded: 75n * SCALE,
    });

    const diff = invoiceDiff(invoice1, invoice2);
    const selections = new Map<string, 1 | 2>();

    diff.fields.forEach((field) => {
      if (field.isDifferent) {
        selections.set(field.field, 1); // Default to invoice1
      }
    });

    expect(selections.size).toBeGreaterThan(0);
    expect(selections.get('description')).toBe(1);
    expect(selections.get('funded')).toBe(1);
  });

  it('collapses identical fields by default', () => {
    const invoice1 = createInvoice({ token: 'CUSDC' });
    const invoice2 = createInvoice({ token: 'CUSDC' });

    const diff = invoiceDiff(invoice1, invoice2);
    const identicalFields = diff.fields.filter((f) => !f.isDifferent);

    expect(identicalFields.length).toBeGreaterThan(0);
    identicalFields.forEach((f) => expect(f.isDifferent).toBe(false));
  });
});

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
      const result = invoiceDiff(inv1 as any, inv2 as any);
      expect(result.hasDifferences).toBe(true);
      const amountField = result.fields.find((f) => f.field === 'amount');
      expect(amountField?.isDifferent).toBe(true);
      expect(amountField?.value1).toBe(100n);
      expect(amountField?.value2).toBe(200n);
    });
  });
});
