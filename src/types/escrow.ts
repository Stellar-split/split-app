/**
 * Escrow Contract Types & Interface Definitions
 *
 * Provides the data structures, condition definitions, state machine types,
 * dispute hold models, release trigger configurations, and contract interface
 * for conditional escrow payments.
 */

export type EscrowStatus =
  | "Created"
  | "Funded"
  | "Evaluating"
  | "ReadyForRelease"
  | "Released"
  | "Disputed"
  | "Refunded"
  | "Cancelled";

export type EscrowConditionType =
  | "TIME_LOCK"
  | "MILESTONE"
  | "APPROVAL"
  | "ORACLE"
  | "THRESHOLD"
  | "CUSTOM";

export type ConditionLogic = "ALL" | "ANY" | "THRESHOLD";

export type ReleaseTriggerType = "AUTOMATIC" | "MANUAL" | "EVENT";

export interface EscrowRecipient {
  address: string;
  amount: bigint;
  name?: string;
  sharePercentage?: number;
}

export interface BaseEscrowCondition {
  id: string;
  type: EscrowConditionType;
  title: string;
  description?: string;
  met: boolean;
  metAt?: number;
  evaluatedAt?: number;
  failureReason?: string;
}

export interface TimeLockCondition extends BaseEscrowCondition {
  type: "TIME_LOCK";
  /** Unix timestamp in seconds after which release is permissible */
  releaseTimestamp: number;
}

export interface MilestoneCondition extends BaseEscrowCondition {
  type: "MILESTONE";
  milestoneId: string;
  completed: boolean;
  completedAt?: number;
  verifiedBy?: string;
  proofUrl?: string;
}

export interface ApprovalCondition extends BaseEscrowCondition {
  type: "APPROVAL";
  requiredSigners: string[];
  minSignatures: number;
  currentSignatures: string[];
  signedAt?: Record<string, number>;
}

export interface OracleCondition extends BaseEscrowCondition {
  type: "ORACLE";
  oracleAddress: string;
  metricKey: string;
  expectedValue: string | number | boolean;
  operator: "eq" | "gte" | "lte" | "neq";
  currentValue?: string | number | boolean;
  lastAttestationTimestamp?: number;
}

export interface ThresholdCondition extends BaseEscrowCondition {
  type: "THRESHOLD";
  targetAmount: bigint;
  currentAmount: bigint;
}

export interface CustomCondition extends BaseEscrowCondition {
  type: "CUSTOM";
  predicateKey: string;
  parameters?: Record<string, unknown>;
}

export type EscrowCondition =
  | TimeLockCondition
  | MilestoneCondition
  | ApprovalCondition
  | OracleCondition
  | ThresholdCondition
  | CustomCondition;

export type DisputeStatus =
  | "Open"
  | "UnderReview"
  | "ResolvedRelease"
  | "ResolvedRefund"
  | "ResolvedSplit";

export interface DisputeDetails {
  id: string;
  initiator: string;
  reason: string;
  evidenceCids?: string[];
  createdAt: number;
  status: DisputeStatus;
  arbitratorNotes?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  splitRatio?: {
    beneficiaryPercentage: number;
    depositorPercentage: number;
  };
}

export interface EscrowPayout {
  recipient: string;
  amount: bigint;
  txHash?: string;
  timestamp: number;
}

export interface ReleaseExecution {
  triggeredBy?: string;
  triggeredAt: number;
  triggerType: ReleaseTriggerType;
  txHash: string;
  payouts: EscrowPayout[];
}

export interface EscrowRefundExecution {
  recipient: string;
  amount: bigint;
  refundedBy: string;
  refundedAt: number;
  reason?: string;
  txHash: string;
}

export interface EscrowStateHistoryEntry {
  id: string;
  from: EscrowStatus;
  to: EscrowStatus;
  timestamp: number;
  actor?: string;
  reason?: string;
}

export interface EscrowContract {
  id: string;
  invoiceId?: string;
  depositor: string;
  beneficiary: string;
  recipients: EscrowRecipient[];
  token: string;
  targetAmount: bigint;
  fundedAmount: bigint;
  status: EscrowStatus;
  releaseTriggerType: ReleaseTriggerType;
  conditionLogic: ConditionLogic;
  thresholdCount?: number;
  conditions: EscrowCondition[];
  disputeHold: boolean;
  dispute?: DisputeDetails;
  releaseExecution?: ReleaseExecution;
  refundExecution?: EscrowRefundExecution;
  history: EscrowStateHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  fundedAt?: number;
  releasedAt?: number;
  refundedAt?: number;
  cancelledAt?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateEscrowInput {
  invoiceId?: string;
  depositor: string;
  beneficiary: string;
  recipients?: EscrowRecipient[];
  token?: string;
  targetAmount: bigint;
  initialDeposit?: bigint;
  releaseTriggerType?: ReleaseTriggerType;
  conditionLogic?: ConditionLogic;
  thresholdCount?: number;
  conditions?: EscrowCondition[];
  metadata?: Record<string, unknown>;
}

export interface ConditionEvaluationContext {
  currentTimestamp?: number;
  fundedAmount?: bigint;
  approvals?: Record<string, string[]>;
  oracleData?: Record<string, Record<string, string | number | boolean>>;
  milestoneCompletions?: Record<string, boolean>;
  customEvaluators?: Record<
    string,
    (condition: CustomCondition, context: ConditionEvaluationContext) => boolean
  >;
}

export interface SingleConditionResult {
  conditionId: string;
  type: EscrowConditionType;
  title: string;
  met: boolean;
  reason?: string;
  evaluatedAt: number;
}

export interface ConditionEvaluationResult {
  canRelease: boolean;
  allMet: boolean;
  metCount: number;
  totalConditions: number;
  conditionResults: SingleConditionResult[];
  failureReasons: string[];
  evaluatedAt: number;
}

export interface ReleaseResult {
  success: boolean;
  released: boolean;
  blockedByDispute?: boolean;
  readyForRelease?: boolean;
  error?: string;
  failureReasons?: string[];
  txHash?: string;
  payouts?: EscrowPayout[];
}

export interface RaiseDisputeInput {
  initiator: string;
  reason: string;
  evidenceCids?: string[];
}

export interface ResolveDisputeInput {
  resolver: string;
  outcome: "RELEASE" | "REFUND" | "SPLIT";
  notes?: string;
  splitRatio?: {
    beneficiaryPercentage: number;
    depositorPercentage: number;
  };
}

export interface EscrowAnalyticsFilter {
  startDate?: number;
  endDate?: number;
  token?: string;
  depositor?: string;
  beneficiary?: string;
  status?: EscrowStatus;
}

export interface EscrowAnalyticsReport {
  summary: {
    totalEscrows: number;
    activeEscrows: number;
    completedEscrows: number;
    releasedEscrows: number;
    refundedEscrows: number;
    disputedEscrows: number;
    cancelledEscrows: number;
    totalValueLocked: bigint;
    totalValueReleased: bigint;
    totalValueRefunded: bigint;
    totalValueDisputed: bigint;
    disputeRatePercentage: number;
    disputeResolutionRatePercentage: number;
    averageDurationSeconds: number;
    averageResolutionSeconds: number;
  };
  byStatus: Record<EscrowStatus, number>;
  byConditionType: Record<EscrowConditionType, { total: number; met: number; passRatePercentage: number }>;
  byToken: Record<string, { totalVolume: bigint; activeTvl: bigint; count: number }>;
  generatedAt: number;
}

/**
 * Escrow Contract Interface
 *
 * Defines the contract methods for lifecycle management, condition evaluation,
 * release execution, dispute management, and analytics queries.
 */
export interface IEscrowContractService {
  createEscrow(input: CreateEscrowInput): EscrowContract;
  getEscrow(id: string): EscrowContract | null;
  listEscrows(filter?: EscrowAnalyticsFilter): EscrowContract[];
  fundEscrow(id: string, amount: bigint, payer: string): EscrowContract;
  updateCondition(id: string, conditionId: string, update: Partial<EscrowCondition>, actor?: string): EscrowContract;
  evaluateConditions(id: string, context?: ConditionEvaluationContext): ConditionEvaluationResult;
  triggerRelease(id: string, actor: string, force?: boolean): ReleaseResult;
  raiseDispute(id: string, input: RaiseDisputeInput): EscrowContract;
  resolveDispute(id: string, input: ResolveDisputeInput): EscrowContract;
  refundEscrow(id: string, actor: string, reason?: string): EscrowContract;
  cancelEscrow(id: string, actor: string, reason?: string): EscrowContract;
  getAnalytics(filter?: EscrowAnalyticsFilter): EscrowAnalyticsReport;
}
