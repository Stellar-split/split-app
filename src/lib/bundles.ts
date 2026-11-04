// Bundles module stub
export interface InvoiceBundle {
  id: string;
  invoiceIds?: string[];
  invoices?: any[];
  items?: Array<{ invoiceId?: string; amount?: string; currency?: string }>;
  createdAt: number;
}
