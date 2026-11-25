/**
 * Invoice analytics calculation for the InvoiceInsights display.
 *
 * Pure, framework-free helpers so the metrics, time-range filtering and
 * trend indicators can be unit tested independently of React.
 */

const STROOPS = 10_000_000;

/** Supported time-range presets for the insights view. */
export type InsightsRange = "7d" | "30d" | "90d" | "all";

/** A single payment as consumed by the analytics helpers. */
export interface InsightsPayment {
  /** Unix timestamp in seconds. */
  timestamp: number;
  /** Amount in stroops. */
  amount: bigint | number | string;
}

/** A single invoice as consumed by the analytics helpers. */
export interface InsightsInvoice {
  /** Unix timestamp in seconds. */
  createdAt?: number;
  /** Unix timestamp in seconds. */
  deadline?: number;
  status?: string;
  payments?: InsightsPayment[];
}

/** Direction of a trend indicator. */
export type TrendDirection = "up" | "down" | "flat";

/** A trend indicator with its percentage change. */
export interface TrendIndicator {
  direction: TrendDirection;
  /** Percentage change between the two periods, rounded to 1 decimal. */
  changePercent: number;
}

/** Aggregated analytics for a set of invoices. */
export interface InvoiceInsightsMetrics {
  totalCollected: number;
  totalInvoices: number;
  paidInvoices: number;
  paymentCount: number;
  averagePayment: number;
  /** Average payment amount per paid invoice. */
  averageInvoiceValue: number;
  successRate: number;
  /** Average hours between invoice creation and its first payment. */
  averagePaymentTimeHours: number;
  largestPayment: number;
}

/** Number of days covered by each range preset (`null` = unbounded). */
export const RANGE_DAYS: Record<InsightsRange, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

/** Convert a stroop amount to a USDC number. */
export function stroopsToUsdc(amount: bigint | number | string): number {
  const value = typeof amount === "bigint" ? Number(amount) : Number(amount);
  return Number.isFinite(value) ? value / STROOPS : 0;
}

/** Round to two decimals to avoid floating point noise in totals. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve the `[from, to]` window (unix seconds) for a range preset.
 * `now` is injectable for deterministic tests.
 */
export function resolveRangeWindow(
  range: InsightsRange,
  now: number = Math.floor(Date.now() / 1000)
): { from: number; to: number } {
  const days = RANGE_DAYS[range];
  if (days === null) return { from: 0, to: now };
  return { from: now - days * 24 * 60 * 60, to: now };
}

/** Filter invoices to those created inside the given window. */
export function filterInvoicesByRange<T extends InsightsInvoice>(
  invoices: T[],
  range: InsightsRange,
  now: number = Math.floor(Date.now() / 1000)
): T[] {
  const { from, to } = resolveRangeWindow(range, now);
  return invoices.filter((invoice) => {
    const createdAt = invoice.createdAt ?? 0;
    return createdAt >= from && createdAt <= to;
  });
}

/** Filter payments to those inside the given window. */
export function filterPaymentsByRange<T extends InsightsPayment>(
  payments: T[],
  range: InsightsRange,
  now: number = Math.floor(Date.now() / 1000)
): T[] {
  const { from, to } = resolveRangeWindow(range, now);
  return payments.filter((p) => p.timestamp >= from && p.timestamp <= to);
}

/**
 * Compute the analytics metrics for a set of invoices.
 * Only payments inside the active range are counted.
 */
export function computeInvoiceInsights(
  invoices: InsightsInvoice[],
  range: InsightsRange = "all",
  now: number = Math.floor(Date.now() / 1000)
): InvoiceInsightsMetrics {
  const scoped = filterInvoicesByRange(invoices, range, now);

  let totalCollected = 0;
  let paymentCount = 0;
  let largestPayment = 0;
  let paidInvoices = 0;
  let paymentTimeTotal = 0;
  let paymentTimeSamples = 0;

  for (const invoice of scoped) {
    const payments = filterPaymentsByRange(invoice.payments ?? [], range, now);
    if (payments.length === 0) continue;

    paidInvoices += 1;
    let invoiceTotal = 0;
    for (const payment of payments) {
      const amount = stroopsToUsdc(payment.amount);
      invoiceTotal += amount;
      paymentCount += 1;
      if (amount > largestPayment) largestPayment = amount;
    }
    totalCollected += invoiceTotal;

    if (typeof invoice.createdAt === "number") {
      const firstPayment = Math.min(...payments.map((p) => p.timestamp));
      const hours = (firstPayment - invoice.createdAt) / 3600;
      if (hours >= 0) {
        paymentTimeTotal += hours;
        paymentTimeSamples += 1;
      }
    }
  }

  const totalInvoices = scoped.length;

  return {
    totalCollected: round2(totalCollected),
    totalInvoices,
    paidInvoices,
    paymentCount,
    averagePayment: paymentCount > 0 ? round2(totalCollected / paymentCount) : 0,
    averageInvoiceValue: paidInvoices > 0 ? round2(totalCollected / paidInvoices) : 0,
    successRate: totalInvoices > 0 ? round2((paidInvoices / totalInvoices) * 100) : 0,
    averagePaymentTimeHours:
      paymentTimeSamples > 0 ? round2(paymentTimeTotal / paymentTimeSamples) : 0,
    largestPayment: round2(largestPayment),
  };
}

/**
 * Compare a metric against the previous period of equal length and return a
 * trend indicator. A zero baseline yields `flat` with 0% change.
 */
export function computeTrend(current: number, previous: number): TrendIndicator {
  if (previous === 0) {
    return { direction: current > 0 ? "up" : "flat", changePercent: current > 0 ? 100 : 0 };
  }
  const changePercent = round2(((current - previous) / Math.abs(previous)) * 100);
  const direction: TrendDirection =
    changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  return { direction, changePercent };
}

/**
 * Compute metrics for the active range plus the trend of each metric versus
 * the immediately preceding period of the same length.
 */
export function computeInvoiceInsightsWithTrends(
  invoices: InsightsInvoice[],
  range: InsightsRange,
  now: number = Math.floor(Date.now() / 1000)
): { metrics: InvoiceInsightsMetrics; trends: Record<keyof InvoiceInsightsMetrics, TrendIndicator> } {
  const metrics = computeInvoiceInsights(invoices, range, now);

  const days = RANGE_DAYS[range];
  const previousNow = days === null ? now : now - days * 24 * 60 * 60;
  const previous = computeInvoiceInsights(invoices, range, previousNow);

  const keys: (keyof InvoiceInsightsMetrics)[] = [
    "totalCollected",
    "totalInvoices",
    "paidInvoices",
    "paymentCount",
    "averagePayment",
    "averageInvoiceValue",
    "successRate",
    "averagePaymentTimeHours",
    "largestPayment",
  ];

  const trends = keys.reduce(
    (acc, key) => {
      acc[key] = computeTrend(metrics[key], previous[key]);
      return acc;
    },
    {} as Record<keyof InvoiceInsightsMetrics, TrendIndicator>
  );

  return { metrics, trends };
}
