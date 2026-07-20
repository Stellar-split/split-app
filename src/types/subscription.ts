export type SubscriptionFrequency = "weekly" | "biweekly" | "monthly";

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface SubscriptionInvoice {
  invoiceId: string;
  generatedAt: number;
  deadline: number;
  amount: bigint;
  status: "Pending" | "Released" | "Refunded";
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
}
