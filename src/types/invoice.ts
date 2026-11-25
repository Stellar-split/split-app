export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export type InvoiceLinkType = 'dependency' | 'conditional';

export interface InvoiceLink {
  id: string;
  sourceInvoiceId: string;
  targetInvoiceId: string;
  type: InvoiceLinkType;
  /** For conditional links: the condition that must be satisfied before the target is unblocked. */
  condition?: InvoiceLinkCondition;
  createdAt: string;
  createdBy?: string;
}

export type InvoiceLinkConditionOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'exists';

export interface InvoiceLinkCondition {
  field: string;
  operator: InvoiceLinkConditionOperator;
  value?: string | number | boolean;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  customerId: string;
  links?: InvoiceLink[];
}

export interface InvoiceLinkValidationError {
  code:
    | 'selfLink'
    | 'duplicateLink'
    | 'missingInvoice'
    | 'circularDependency'
    | 'invalidCondition';
  message: string;
  linkId?: string;
  invoiceIds?: string[];
}

export interface InvoiceLinkValidationResult {
  valid: boolean;
  errors: InvoiceLinkValidationError[];
}

export interface InvoiceDependencyResolution {
  invoiceId: string;
  /** Invoices that must be resolved before this invoice can proceed. */
  blockedBy: string[];
  /** Invoices that depend on this invoice. */
  blocks: string[];
  /** True when all dependencies are resolved and conditions satisfied. */
  resolved: boolean;
  /** Unresolved dependency invoice ids preventing resolution. */
  unresolved: string[];
}

export interface InvoiceLinkAnalytics {
  totalLinks: number;
  dependencyLinks: number;
  conditionalLinks: number;
  /** Invoices with no incoming or outgoing links. */
  orphanedInvoiceIds: string[];
  /** Detected circular dependency chains (each is an ordered list of invoice ids). */
  circularChains: string[][];
  /** Number of links per invoice id. */
  linksByInvoice: Record<string, number>;
}
