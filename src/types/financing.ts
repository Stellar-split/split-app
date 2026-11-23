/**
 * Invoice financing domain types.
 *
 * Supports creators requesting advance payments against outstanding invoices,
 * an approval workflow, advance disbursement, fee calculation, and analytics.
 */

export type FinancingApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'repaid'
  | 'cancelled';

export type FinancingFeeType = 'flat' | 'percentage';

/** A single tier in the fee schedule, keyed by advance term in days. */
export interface FinancingFeeTier {
  /** Advance term in days (e.g. 30, 60, 90). */
  termDays: number;
  /** Fee type applied for this tier. */
  feeType: FinancingFeeType;
  /** Fee value: absolute amount for `flat`, or rate (0-1) for `percentage`. */
  feeValue: number;
  /** Minimum fee charged regardless of computed amount. */
  minimumFee?: number;
}

/** Financing product configuration offered to creators. */
export interface FinancingProduct {
  id: string;
  name: string;
  description?: string;
  /** Fraction of the invoice amount advanced up front (0-1). */
  advanceRate: number;
  /** Minimum invoice amount eligible for financing. */
  minimumInvoiceAmount: number;
  /** Maximum invoice amount eligible for financing. */
  maximumInvoiceAmount: number;
  /** Allowed advance terms in days. */
  allowedTerms: number[];
  /** Fee schedule applied based on the selected term. */
  feeSchedule: FinancingFeeTier[];
  /** Whether the product is currently available for new applications. */
  active: boolean;
}

/** Eligibility result for a creator against a financing product. */
export interface FinancingEligibility {
  eligible: boolean;
  productId: string;
  /** Human-readable reasons when not eligible. */
  reasons: string[];
  /** Maximum advance amount the creator qualifies for. */
  maxAdvanceAmount?: number;
}

/** A creator's application for an advance on a specific invoice. */
export interface FinancingApplication {
  id: string;
  creatorId: string;
  invoiceId: string;
  productId: string;
  /** Requested advance amount. */
  requestedAmount: number;
  /** Selected advance term in days. */
  termDays: number;
  status: FinancingApplicationStatus;
  /** Computed fee for the application. */
  feeAmount?: number;
  /** Net amount disbursed after fees. */
  netDisbursement?: number;
  /** Reviewer who approved or rejected the application. */
  reviewedBy?: string;
  /** Reason provided on rejection. */
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  disbursedAt?: string;
}

/** Result of a fee calculation for a given advance. */
export interface FinancingFeeCalculation {
  advanceAmount: number;
  termDays: number;
  feeAmount: number;
  netDisbursement: number;
  feeTier: FinancingFeeTier;
}

/** Record of an advance disbursement tied to an approved application. */
export interface FinancingDisbursement {
  id: string;
  applicationId: string;
  creatorId: string;
  invoiceId: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  status: 'pending' | 'completed' | 'failed';
  disbursedAt?: string;
  createdAt: string;
}

/** Aggregated financing analytics for reporting. */
export interface FinancingAnalytics {
  totalApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  disbursedApplications: number;
  totalAdvancedAmount: number;
  totalFeesCollected: number;
  averageAdvanceAmount: number;
  averageTermDays: number;
  approvalRate: number;
}
