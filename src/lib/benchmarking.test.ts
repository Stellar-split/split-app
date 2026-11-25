import { describe, expect, it } from "vitest";
import {
  anonymizeBenchmarkReport,
  BENCHMARK_MIN_SAMPLE_SIZE,
  buildBenchmarkReport,
} from "./benchmarking";

describe("buildBenchmarkReport", () => {
  it("ranks performance against the reference percentiles", () => {
    const report = buildBenchmarkReport(
      { invoiceCount: 20, successfulInvoices: 15, totalRaised: 4000 },
      new Date("2026-01-01T00:00:00.000Z")
    );

    expect(report).not.toBeNull();
    expect(report?.sampleSize).toBe(20);
    expect(report?.referenceModel).toBe("Illustrative B2B baseline v1");
    expect(report?.metrics.map((metric) => metric.percentile)).toEqual([50, 50]);
  });

  it("withholds rankings below the minimum reporting sample", () => {
    expect(
      buildBenchmarkReport({
        invoiceCount: BENCHMARK_MIN_SAMPLE_SIZE - 1,
        successfulInvoices: 1,
        totalRaised: 100,
      })
    ).toBeNull();
  });

  it("rejects invalid counts and non-finite amounts", () => {
    expect(
      buildBenchmarkReport({
        invoiceCount: 5,
        successfulInvoices: 6,
        totalRaised: 100,
      })
    ).toBeNull();
    expect(
      buildBenchmarkReport({
        invoiceCount: 5,
        successfulInvoices: 2,
        totalRaised: Number.NaN,
      })
    ).toBeNull();
  });

  it("exports only aggregate, rounded metrics", () => {
    const report = buildBenchmarkReport({
      invoiceCount: 8,
      successfulInvoices: 7,
      totalRaised: 1234.567,
    });
    expect(report).not.toBeNull();

    if (!report) throw new Error("Expected a report for a valid sample");
    const anonymous = anonymizeBenchmarkReport(report);
    expect(JSON.stringify(anonymous)).not.toMatch(/creator|payer|invoice.?id|wallet/i);
    expect(anonymous.metrics[1].value).toBe(154.32);
  });
});
