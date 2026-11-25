export type PaymentMethodType =
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'cash'
  | 'crypto';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  currency: string;
  /** Fee rate applied to payments made with this method (e.g. 0.029 = 2.9%). */
  feeRate: number;
  /** Flat fee per transaction for this method, in minor units. */
  flatFee: number;
}

export interface Payment {
  id: string;
  methodId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}

/** Aggregated totals for a single payment method. */
export interface MethodAggregate {
  methodId: string;
  type: PaymentMethodType;
  currency: string;
  paymentCount: number;
  grossAmount: number;
  totalFees: number;
  netAmount: number;
}

/** Consolidated balance across all methods for a currency. */
export interface BalanceAggregate {
  currency: string;
  grossAmount: number;
  totalFees: number;
  netAmount: number;
  paymentCount: number;
}

/** Fee optimization suggestion for routing payments to cheaper methods. */
export interface FeeOptimization {
  methodId: string;
  currentFeeRate: number;
  suggestedFeeRate: number;
  estimatedSavings: number;
}

/** Consolidated report combining per-method and per-currency aggregation. */
export interface PaymentAggregationReport {
  generatedAt: string;
  methods: MethodAggregate[];
  balances: BalanceAggregate[];
  optimizations: FeeOptimization[];
  analytics: PaymentAggregationAnalytics;
}

/** Analytics derived from the aggregation. */
export interface PaymentAggregationAnalytics {
  totalPayments: number;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  /** Effective fee rate across all aggregated payments. */
  effectiveFeeRate: number;
  /** Method id with the highest gross volume. */
  topMethodId: string | null;
  /** Method id with the lowest effective fee rate. */
  cheapestMethodId: string | null;
}
