export const BENCHMARK_MIN_SAMPLE_SIZE = 5;

export interface BenchmarkInput {
  invoiceCount: number;
  successfulInvoices: number;
  totalRaised: number;
}

export interface BenchmarkMetric {
  key: "completionRate" | "raisedPerInvoice";
  label: string;
  value: number;
  unit: "%" | "USDC";
  percentile: number;
  benchmarkMedian: number;
  direction: "higher" | "neutral";
}

export interface BenchmarkReport {
  generatedAt: string;
  sampleSize: number;
  referenceModel: string;
  metrics: BenchmarkMetric[];
}

export const INDUSTRY_PAYMENT_REFERENCE = {
  lateInvoicePercent: 60,
  averageDaysLate: 6,
  smeAverageDaysLate: 4.3,
  source: "https://grow.exim.gov/blog/key-facts-and-figures-on-late-invoice-payments",
  sourceDate: "2017-05-11",
} as const;

type PercentileAnchor = { percentile: number; value: number };

const REFERENCE_MODEL = "Illustrative B2B baseline v1";

const COMPLETION_RATE_REFERENCE: PercentileAnchor[] = [
  { percentile: 0, value: 0 },
  { percentile: 10, value: 50 },
  { percentile: 25, value: 65 },
  { percentile: 50, value: 75 },
  { percentile: 75, value: 85 },
  { percentile: 90, value: 95 },
  { percentile: 100, value: 100 },
];

const RAISED_PER_INVOICE_REFERENCE: PercentileAnchor[] = [
  { percentile: 0, value: 0 },
  { percentile: 10, value: 20 },
  { percentile: 25, value: 75 },
  { percentile: 50, value: 200 },
  { percentile: 75, value: 600 },
  { percentile: 90, value: 2000 },
  { percentile: 100, value: 20000 },
];

function interpolatePercentile(value: number, anchors: PercentileAnchor[]): number {
  if (value <= anchors[0].value) return anchors[0].percentile;
  const last = anchors[anchors.length - 1];
  if (value >= last.value) return last.percentile;

  for (let index = 1; index < anchors.length; index++) {
    const lower = anchors[index - 1];
    const upper = anchors[index];
    if (value <= upper.value) {
      const ratio = (value - lower.value) / (upper.value - lower.value);
      return lower.percentile + ratio * (upper.percentile - lower.percentile);
    }
  }

  return last.percentile;
}

function safeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function buildBenchmarkReport(input: BenchmarkInput, generatedAt = new Date()): BenchmarkReport | null {
  if (
    !Number.isInteger(input.invoiceCount) ||
    input.invoiceCount < BENCHMARK_MIN_SAMPLE_SIZE ||
    !Number.isInteger(input.successfulInvoices) ||
    input.successfulInvoices < 0 ||
    input.successfulInvoices > input.invoiceCount ||
    !safeNumber(input.totalRaised)
  ) {
    return null;
  }

  const completionRate = (input.successfulInvoices / input.invoiceCount) * 100;
  const raisedPerInvoice = input.totalRaised / input.invoiceCount;

  return {
    generatedAt: generatedAt.toISOString(),
    sampleSize: input.invoiceCount,
    referenceModel: REFERENCE_MODEL,
    metrics: [
      {
        key: "completionRate",
        label: "Invoice completion rate",
        value: completionRate,
        unit: "%",
        percentile: interpolatePercentile(completionRate, COMPLETION_RATE_REFERENCE),
        benchmarkMedian: 75,
        direction: "higher",
      },
      {
        key: "raisedPerInvoice",
        label: "Raised per invoice",
        value: raisedPerInvoice,
        unit: "USDC",
        percentile: interpolatePercentile(raisedPerInvoice, RAISED_PER_INVOICE_REFERENCE),
        benchmarkMedian: 200,
        direction: "neutral",
      },
    ],
  };
}

export function anonymizeBenchmarkReport(report: BenchmarkReport): BenchmarkReport {
  return {
    generatedAt: report.generatedAt,
    sampleSize: report.sampleSize,
    referenceModel: report.referenceModel,
    metrics: report.metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: Number(metric.value.toFixed(2)),
      unit: metric.unit,
      percentile: Math.round(metric.percentile),
      benchmarkMedian: metric.benchmarkMedian,
      direction: metric.direction,
    })),
  };
}
