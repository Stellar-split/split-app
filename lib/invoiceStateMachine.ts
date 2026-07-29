export type InvoiceStatus = 'Draft' | 'Pending' | 'Partially Paid' | 'Fully Paid' | 'Disputed';

const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  Draft: ['Pending', 'Disputed'],
  Pending: ['Partially Paid', 'Fully Paid', 'Disputed', 'Draft'],
  'Partially Paid': ['Fully Paid', 'Disputed', 'Pending'],
  'Fully Paid': ['Disputed'],
  Disputed: ['Draft', 'Pending', 'Fully Paid'],
};

export function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true;
  return validTransitions[from]?.includes(to) ?? false;
}
