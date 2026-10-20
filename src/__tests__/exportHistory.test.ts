import {
  addExportHistoryEntry,
  completeScheduledInvoiceExport,
  getExportHistory,
  getScheduledInvoiceExports,
  scheduleInvoiceExport,
} from '@/lib/exportHistory';

describe('invoice export history and scheduling', () => {
  beforeEach(() => window.localStorage.clear());

  it('records completed exports with their format and invoice filters', () => {
    addExportHistoryEntry({ format: 'xml', filters: { invoiceId: 'invoice-1' }, recordCount: 1, status: 'completed' });
    expect(getExportHistory()).toMatchObject([{ format: 'xml', filters: { invoiceId: 'invoice-1' }, recordCount: 1, status: 'completed' }]);
  });

  it('persists a snapshot and marks a scheduled export complete', () => {
    const job = scheduleInvoiceExport({
      invoiceId: 'invoice-1',
      format: 'json',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      content: '{"id":"invoice-1"}',
      mimeType: 'application/json',
      extension: 'json',
    });
    expect(getScheduledInvoiceExports()).toContainEqual(job);
    completeScheduledInvoiceExport(job.id);
    expect(getScheduledInvoiceExports()[0].status).toBe('completed');
  });
});