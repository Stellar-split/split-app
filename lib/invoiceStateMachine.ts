export type InvoiceStatus = 'Draft' | 'Pending' | 'Partially Paid' | 'Fully Paid' | 'Disputed';

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  Draft: ['Pending', 'Disputed'],
  Pending: ['Partially Paid', 'Fully Paid', 'Disputed'],
  'Partially Paid': ['Fully Paid', 'Disputed'],
  'Fully Paid': [],
  Disputed: ['Pending', 'Fully Paid']
};

export function statusTransitionGuard(current: InvoiceStatus, target: InvoiceStatus): boolean {
  if (current === target) return true;
  return ALLOWED_TRANSITIONS[current]?.includes(target) ?? false;
}
