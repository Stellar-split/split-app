import { getInvoiceOcrAnalytics, recognizeInvoiceFields, recordInvoiceOcrReview } from '@/lib/invoiceOcr';

describe('recognizeInvoiceFields', () => {
  it('extracts invoice fields and scores recognized values', () => {
    const address = `G${'A'.repeat(55)}`;
    const result = recognizeInvoiceFields(`Recipient ${address}. Total due: $1,234.50 USDC. Due in 14 days.`, 90);
    expect(result.fields).toEqual({ recipient_address: address, amount: '1234.50', deadline_days: '14', token: 'USDC' });
    expect(result.confidence.recipient_address).toBe(90);
    expect(result.confidence.amount).toBeGreaterThan(70);
  });

  it('leaves unrecognized values empty with zero confidence', () => {
    const result = recognizeInvoiceFields('An invoice without recognized fields', 75);
    expect(result.fields.amount).toBe('');
    expect(result.confidence.amount).toBe(0);
  });
});

describe('OCR correction analytics', () => {
  beforeEach(() => window.localStorage.clear());

  it('tracks reviewed and corrected fields without storing invoice contents', () => {
    const original = { recipient_address: 'G1', amount: '1', deadline_days: '5', token: 'USDC' };
    recordInvoiceOcrReview(original, { ...original, amount: '2' });
    expect(getInvoiceOcrAnalytics()).toEqual({ extractions: 1, reviewedFields: 4, correctedFields: 1 });
    expect(window.localStorage.getItem('invoice_ocr_analytics_v1')).not.toContain('G1');
  });
});