// Bundles module stub
export interface InvoiceBundle {
  id: string;
  name?: string;
  invoiceIds?: string[];
  invoices?: any[];
  items?: Array<{ invoiceId?: string; amount?: string; currency?: string }>;
  createdAt?: number;
  paidAmount?: number;
  status?: string;
  description?: string;
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export interface Invoice {
  id: string;
  number: string;
  clientName: string;
  amount: number;
  amountDue?: number;
  amountPaid?: number;
  currency: string;
  status: InvoiceStatus;
}

export interface PaymentOptions {
  allowPartialPayment?: boolean;
  dueDate?: string;
  currency?: string;
}

export interface BundleService {
  createBundle(options: any): Promise<InvoiceBundle>;
  updateBundle(bundle: InvoiceBundle): Promise<InvoiceBundle>;
  deleteBundle(id: string): Promise<void>;
  getBundle(id: string): Promise<InvoiceBundle>;
  listBundles(): Promise<InvoiceBundle[]>;
}
