import { statusTransitionGuard, InvoiceStatus } from '../invoiceStateMachine';

describe('invoiceStateMachine', () => {
  const statuses: InvoiceStatus[] = ['Draft', 'Pending', 'Partially Paid', 'Fully Paid', 'Disputed'];

  test('allows valid transitions and self-transitions', () => {
    expect(statusTransitionGuard('Draft', 'Pending')).toBe(true);
    expect(statusTransitionGuard('Pending', 'Fully Paid')).toBe(true);
    expect(statusTransitionGuard('Draft', 'Draft')).toBe(true);
  });

  test('rejects invalid transitions', () => {
    expect(statusTransitionGuard('Draft', 'Fully Paid')).toBe(false);
    expect(statusTransitionGuard('Fully Paid', 'Pending')).toBe(false);
  });
});
