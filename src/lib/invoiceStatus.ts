export const STATUS_CONFIG: Record<string, { color: string; label: string; icon?: string }> = {
  Pending: { color: 'blue', label: 'Pending' },
  Funded: { color: 'green', label: 'Funded' },
  Released: { color: 'green', label: 'Released' },
  Refunded: { color: 'red', label: 'Refunded' },
  Cancelled: { color: 'gray', label: 'Cancelled' },
};

export function getDisputesByInvoice(invoiceId: string): any[] {
  return [];
}

export function checkReleaseBlock(invoice: any): string | null {
  return null;
}
