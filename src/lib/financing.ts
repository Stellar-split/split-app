export type FinancingStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'repaid';

export interface FinancingProduct {
  id: string;
  name: string;
  /** Fraction of invoice face value advanced up front (0-1). */
  advanceRate: number;
  /** Flat fee rate applied to the advanced amount (0-1). */
  feeRate: number;
  /** Minimum invoice amount eligible for financing. */
  minInvoiceAmount: number;
  /** Maximum invoice amount eligible for financing. */
  maxInvoiceAmount: number;
  /** Minimum creator account age in days to be eligible. */
  minAccountAgeDays: number;
  /** Minimum number of previously paid invoices to be eligible. */
  minPaidInvoices: number;
  /** Term length in days for the advance. */
  termDays: number;
}

export interface Invoice {
  id: string;
  creatorId: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'open' | 'paid' | 'overdue';
}

export interface CreatorProfile {
  id: string;
  accountAgeDays: number;
  paidInvoiceCount: number;
}

export interface FinancingApplication {
  id: string;
  invoiceId: string;
  creatorId: string;
  productId: string;
  requestedAmount: number;
  status: FinancingStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  disbursedAt?: string;
  rejectionReason?: string;
}

export interface FeeBreakdown {
  advanceAmount: number;
  feeAmount: number;
  totalRepayment: number;
  netDisbursement: number;
}

export interface Disbursement {
  applicationId: string;
  amount: number;
  currency: string;
  disbursedAt: string;
}

export interface FinancingAnalytics {
  totalApplications: number;
  approvedCount: number;
  rejectedCount: number;
  disbursedCount: number;
  totalAdvanced: number;
  totalFees: number;
  approvalRate: number;
}

export const DEFAULT_FINANCING_PRODUCT: FinancingProduct = {
  id: 'standard-advance',
  name: 'Standard Invoice Advance',
  advanceRate: 0.8,
  feeRate: 0.03,
  minInvoiceAmount: 100,
  maxInvoiceAmount: 100000,
  minAccountAgeDays: 30,
  minPaidInvoices: 3,
  termDays: 30,
};

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function checkEligibility(
  invoice: Invoice,
  creator: CreatorProfile,
  product: FinancingProduct = DEFAULT_FINANCING_PRODUCT,
): EligibilityResult {
  const reasons: string[] = [];

  if (invoice.status !== 'open') {
    reasons.push('Invoice must be open to finance');
  }
  if (invoice.amount < product.minInvoiceAmount) {
    reasons.push(`Invoice amount below minimum of ${product.minInvoiceAmount}`);
  }
  if (invoice.amount > product.maxInvoiceAmount) {
    reasons.push(`Invoice amount above maximum of ${product.maxInvoiceAmount}`);
  }
  if (creator.accountAgeDays < product.minAccountAgeDays) {
    reasons.push(`Account must be at least ${product.minAccountAgeDays} days old`);
  }
  if (creator.paidInvoiceCount < product.minPaidInvoices) {
    reasons.push(`Requires at least ${product.minPaidInvoices} previously paid invoices`);
  }

  return { eligible: reasons.length === 0, reasons };
}

export function calculateFees(
  invoiceAmount: number,
  product: FinancingProduct = DEFAULT_FINANCING_PRODUCT,
): FeeBreakdown {
  const advanceAmount = round2(invoiceAmount * product.advanceRate);
  const feeAmount = round2(advanceAmount * product.feeRate);
  const totalRepayment = round2(advanceAmount + feeAmount);
  const netDisbursement = round2(advanceAmount - feeAmount);

  return { advanceAmount, feeAmount, totalRepayment, netDisbursement };
}

export interface CreateApplicationInput {
  id: string;
  invoice: Invoice;
  creator: CreatorProfile;
  product?: FinancingProduct;
  now?: string;
}

export interface CreateApplicationResult {
  application?: FinancingApplication;
  eligibility: EligibilityResult;
  fees?: FeeBreakdown;
}

export function createApplication(input: CreateApplicationInput): CreateApplicationResult {
  const product = input.product ?? DEFAULT_FINANCING_PRODUCT;
  const eligibility = checkEligibility(input.invoice, input.creator, product);

  if (!eligibility.eligible) {
    return { eligibility };
  }

  const fees = calculateFees(input.invoice.amount, product);
  const now = input.now ?? new Date().toISOString();

  const application: FinancingApplication = {
    id: input.id,
    invoiceId: input.invoice.id,
    creatorId: input.creator.id,
    productId: product.id,
    requestedAmount: fees.advanceAmount,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  };

  return { application, eligibility, fees };
}

const ALLOWED_TRANSITIONS: Record<FinancingStatus, FinancingStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed'],
  rejected: [],
  disbursed: ['repaid'],
  repaid: [],
};

export function canTransition(from: FinancingStatus, to: FinancingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionInput {
  application: FinancingApplication;
  to: FinancingStatus;
  now?: string;
  rejectionReason?: string;
}

export function transitionApplication(input: TransitionInput): FinancingApplication {
  const { application, to } = input;

  if (!canTransition(application.status, to)) {
    throw new Error(`Invalid financing transition: ${application.status} -> ${to}`);
  }

  const now = input.now ?? new Date().toISOString();
  const updated: FinancingApplication = {
    ...application,
    status: to,
    updatedAt: now,
  };

  if (to === 'approved' || to === 'rejected') {
    updated.reviewedAt = now;
  }
  if (to === 'rejected' && input.rejectionReason) {
    updated.rejectionReason = input.rejectionReason;
  }

  return updated;
}

export interface DisburseInput {
  application: FinancingApplication;
  invoice: Invoice;
  product?: FinancingProduct;
  now?: string;
}

export function disburseAdvance(input: DisburseInput): {
  application: FinancingApplication;
  disbursement: Disbursement;
  fees: FeeBreakdown;
} {
  const { application, invoice } = input;

  if (application.status !== 'approved') {
    throw new Error('Only approved applications can be disbursed');
  }

  const product = input.product ?? DEFAULT_FINANCING_PRODUCT;
  const fees = calculateFees(invoice.amount, product);
  const now = input.now ?? new Date().toISOString();

  const updated: FinancingApplication = {
    ...application,
    status: 'disbursed',
    disbursedAt: now,
    updatedAt: now,
  };

  const disbursement: Disbursement = {
    applicationId: application.id,
    amount: fees.netDisbursement,
    currency: invoice.currency,
    disbursedAt: now,
  };

  return { application: updated, disbursement, fees };
}

export function computeAnalytics(
  applications: FinancingApplication[],
  product: FinancingProduct = DEFAULT_FINANCING_PRODUCT,
): FinancingAnalytics {
  const totalApplications = applications.length;
  const approvedCount = applications.filter(
    (a) => a.status === 'approved' || a.status === 'disbursed' || a.status === 'repaid',
  ).length;
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length;
  const disbursed = applications.filter(
    (a) => a.status === 'disbursed' || a.status === 'repaid',
  );
  const disbursedCount = disbursed.length;

  let totalAdvanced = 0;
  let totalFees = 0;
  for (const app of disbursed) {
    const fees = calculateFees(app.requestedAmount / product.advanceRate, product);
    totalAdvanced += fees.advanceAmount;
    totalFees += fees.feeAmount;
  }

  const decided = approvedCount + rejectedCount;
  const approvalRate = decided === 0 ? 0 : approvedCount / decided;

  return {
    totalApplications,
    approvedCount,
    rejectedCount,
    disbursedCount,
    totalAdvanced: round2(totalAdvanced),
    totalFees: round2(totalFees),
    approvalRate,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
