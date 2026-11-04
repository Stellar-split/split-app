// Bundles module stub
export interface InvoiceBundle {
  id: string;
  invoiceIds: string[];
  items?: Array<{ amount?: string; currency?: string }>;
  createdAt: number;
}
