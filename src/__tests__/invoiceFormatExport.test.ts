import { generateInvoiceExport } from '@/lib/invoiceFormatExport';
import type { Invoice } from '@stellar-split/sdk';

const invoice: Invoice = {
  id: 'invoice-1',
  creator: 'G<creator>',
  recipients: [{ address: 'G&recipient', amount: 12500000n }],
  payments: [{ payer: 'G"payer', amount: 2500000n }],
  status: 'Pending',
  funded: 2500000n,
  token: 'USDC',
  deadline: 0,
};

describe('generateInvoiceExport', () => {
  it('preserves amount precision in JSON', () => {
    const result = generateInvoiceExport(invoice, 12500000n, 'json');
    expect(result.extension).toBe('json');
    expect(JSON.parse(result.content)).toMatchObject({ total: '1.2500000', funded: '0.2500000' });
  });

  it('escapes XML and HTML values', () => {
    expect(generateInvoiceExport(invoice, 12500000n, 'xml').content).toContain('G&lt;creator&gt;');
    expect(generateInvoiceExport(invoice, 12500000n, 'html').content).toContain('G&amp;recipient');
  });

  it('renders values into a custom template', () => {
    const result = generateInvoiceExport(invoice, 12500000n, 'custom', '{{id}}: {{total}} {{token}}');
    expect(result.content).toBe('invoice-1: 1.2500000 USDC');
    expect(result.extension).toBe('txt');
  });
});