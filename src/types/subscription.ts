export type SubscriptionFrequency = "weekly" | "biweekly" | "monthly";

export type SubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "past_due"
  | "expired";

export type CancellationReason =
  | "too_expensive"
  | "not_using"
  | "switched_service"
  | "other";

export interface SubscriptionInvoice {
  invoiceId: string;
  generatedAt: number;
  deadline: number;
  amount: bigint;
  status: "Pending" | "Released" | "Refunded";
}

export interface SubscriptionModification {
  id: string;
  modifiedAt: number;
  field: string;
  previousValue: string | number | null;
  newValue: string | number | null;
  reason?: string;
}

export interface Subscription {
  id: string;
  templateName: string;
  creator: string;
  recipients: Array<{ address: string; amount: bigint }>;
  frequency: SubscriptionFrequency;
  intervalDays: number;
  status: SubscriptionStatus;
  createdAt: number;
  nextRunDate: number;
  lastRunDate: number | null;
  token: string;
  totalInvoicesGenerated: number;
  totalUsdcCollected: bigint;
  invoiceHistory: SubscriptionInvoice[];
  pausedAt?: number | null;
  resumedAt?: number | null;
  cancellationReason?: CancellationReason | null;
  cancelledAt?: number | null;
  modificationHistory?: SubscriptionModification[];
}

export interface SubscriptionAnalytics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  pausedSubscriptions: number;
  cancelledSubscriptions: number;
  pastDueSubscriptions: number;
  expiredSubscriptions: number;
  totalUsdcCollected: bigint;
  totalInvoicesGenerated: number;
  cancellationReasons: Record<CancellationReason, number>;
  pauseRate: number;
  cancellationRate: number;
  churnRate: number;
  averageLifetimeDays: number;
  modificationsCount: number;
  periodStart: number;
  periodEnd: number;
}