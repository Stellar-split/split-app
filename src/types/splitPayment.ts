/**
 * Types for split payment distribution — enabling a single payment
 * to be automatically split and distributed to multiple recipients.
 */

import type { RecipientLine, DerivedRecipientLine, SplitValidation } from '@/hooks/useSplitCalculator';

// ── Split Payment Status ────────────────────────────────────────────────────

export type SplitPaymentStatus =
  | 'pending'
  | 'validating'
  | 'confirmed'
  | 'executing'
  | 'completed'
  | 'partial_failure'
  | 'failed'
  | 'cancelled';

export type RecipientPaymentStatus =
  | 'pending'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'retrying';

// ── Split Rule Types ────────────────────────────────────────────────────────

export type SplitRuleType =
  | 'min_amount'
  | 'max_amount'
  | 'max_recipients'
  | 'min_share_percent'
  | 'unique_addresses'
  | 'valid_addresses'
  | 'sufficient_balance';

export interface SplitRule {
  type: SplitRuleType;
  /** Human-readable description of this rule */
  description: string;
  /** Whether the rule passed validation */
  passed: boolean;
  /** Error message when the rule fails */
  errorMessage?: string;
}

export interface SplitRuleConfig {
  /** Minimum per-recipient amount (in asset units, e.g. 0.0000001 XLM) */
  minRecipientAmount: number;
  /** Maximum total amount for a single split payment */
  maxTotalAmount: number;
  /** Maximum number of recipients per split */
  maxRecipients: number;
  /** Minimum share percentage per recipient */
  minSharePercent: number;
  /** Whether to enforce unique addresses */
  requireUniqueAddresses: boolean;
  /** Whether to validate Stellar addresses (G...) */
  requireValidAddresses: boolean;
  /** Available balance for sufficient balance check */
  availableBalance?: number;
}

// ── Recipient Payment Result ────────────────────────────────────────────────

export interface RecipientPaymentResult {
  /** Recipient address */
  address: string;
  /** Amount sent to this recipient */
  amount: number;
  /** Share percentage of total */
  sharePercent: number;
  /** Current status */
  status: RecipientPaymentStatus;
  /** Transaction hash when succeeded */
  txHash?: string;
  /** Error message when failed */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** Timestamp when payment was initiated */
  initiatedAt: number;
  /** Timestamp when payment was completed (success or final failure) */
  completedAt?: number;
}

// ── Split Payment Request ───────────────────────────────────────────────────

export interface SplitPaymentRequest {
  /** Unique ID for this split payment */
  id: string;
  /** Payer wallet address */
  payerAddress: string;
  /** Total amount to split */
  totalAmount: number;
  /** Asset code for the payment */
  assetCode: 'XLM' | 'USDC';
  /** Recipient definitions with share percentages */
  recipients: RecipientLine[];
  /** Optional memo for the transactions */
  memo?: string;
  /** Optional invoice ID this split is associated with */
  invoiceId?: string;
}

// ── Split Payment Confirmation ──────────────────────────────────────────────

export interface SplitPaymentConfirmation {
  /** The original split payment request */
  request: SplitPaymentRequest;
  /** Derived split calculations */
  derivedLines: DerivedRecipientLine[];
  /** Validation state */
  validation: SplitValidation;
  /** Rule validation results */
  rules: SplitRule[];
  /** Whether all rules passed */
  allRulesPassed: boolean;
  /** Summary totals */
  totalGross: number;
  totalTax: number;
  totalFees: number;
  totalNet: number;
  /** Whether user has confirmed the split */
  userConfirmed: boolean;
  /** Timestamp when confirmation was created */
  createdAt: number;
  /** Timestamp when user confirmed */
  confirmedAt?: number;
}

// ── Split Payment Execution Result ──────────────────────────────────────────

export interface SplitPaymentResult {
  /** The original split payment request */
  request: SplitPaymentRequest;
  /** Overall status of the split payment */
  status: SplitPaymentStatus;
  /** Per-recipient payment results */
  recipientResults: RecipientPaymentResult[];
  /** Number of successful payments */
  successCount: number;
  /** Number of failed payments */
  failureCount: number;
  /** Total amount successfully distributed */
  totalDistributed: number;
  /** Total amount that failed to distribute */
  totalFailed: number;
  /** Timestamp when execution started */
  startedAt: number;
  /** Timestamp when execution completed */
  completedAt?: number;
  /** Aggregated error message for partial/full failure */
  error?: string;
}

// ── Split Payment Hook State ────────────────────────────────────────────────

export interface SplitPaymentState {
  /** Current status of the overall split payment */
  status: SplitPaymentStatus;
  /** Confirmation object when in confirmed state */
  confirmation: SplitPaymentConfirmation | null;
  /** Execution result when executing or completed */
  result: SplitPaymentResult | null;
  /** Whether the payment is in progress */
  isExecuting: boolean;
  /** Global error message */
  error: string | null;
}

// ── Payment Executor Interface ──────────────────────────────────────────────

/**
 * Interface for the function that executes a single recipient payment.
 * Allows dependency injection for testing and different payment backends.
 */
export type PaymentExecutor = (params: {
  payerAddress: string;
  recipientAddress: string;
  amount: number;
  assetCode: 'XLM' | 'USDC';
  memo?: string;
}) => Promise<{ txHash: string }>;
