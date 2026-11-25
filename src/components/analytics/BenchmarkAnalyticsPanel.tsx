"use client";

import { useMemo } from "react";
import {
  anonymizeBenchmarkReport,
  buildBenchmarkReport,
  INDUSTRY_PAYMENT_REFERENCE,
  type BenchmarkInput,
} from "@/lib/benchmarking";

type Props = BenchmarkInput;

function percentileLabel(percentile: number): string {
  const rounded = Math.round(percentile);
  const suffix =
    rounded % 100 >= 11 && rounded % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[rounded % 10] ?? "th");
  return `${rounded}${suffix} percentile`;
}

export default function BenchmarkAnalyticsPanel(props: Props) {
  const report = useMemo(
    () => buildBenchmarkReport(props),
    [props.invoiceCount, props.successfulInvoices, props.totalRaised]
  );

  function downloadReport() {
    if (!report) return;
    const anonymousReport = anonymizeBenchmarkReport(report);
    const blob = new Blob([JSON.stringify(anonymousReport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stellarsplit-benchmark-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section
      aria-labelledby="benchmark-heading"
      className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="benchmark-heading" className="text-lg font-semibold text-white">
            Benchmarking
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Compare your invoice results with an illustrative B2B reference model.
          </p>
        </div>
        {report && (
          <button
            type="button"
            onClick={downloadReport}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Download report
          </button>
        )}
      </div>

      {!report ? (
        <p className="rounded-lg bg-gray-800/70 p-4 text-sm text-gray-300">
          At least 5 invoices are required to show a benchmark report. Your data
          remains in this browser and no invoice, wallet, or payer identifiers
          are shared.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {report.metrics.map((metric) => (
              <article key={metric.key} className="rounded-lg bg-gray-800/70 p-4">
                <h3 className="text-sm font-medium text-gray-300">{metric.label}</h3>
                <p className="mt-2 text-2xl font-bold text-white">
                  {metric.value.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                  {metric.unit === "%" ? "%" : ` ${metric.unit}`}
                </p>
                <p className="mt-1 text-sm text-indigo-300">
                  {percentileLabel(metric.percentile)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Reference median:{" "}
                  {metric.benchmarkMedian.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                  {metric.unit === "%" ? "%" : ` ${metric.unit}`}
                  {metric.direction === "higher" ? " (higher is better)" : ""}
                </p>
              </article>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            Percentile thresholds use the {report.referenceModel}; they are
            provisional estimates, not verified live industry or competitor
            data. Rankings are calculated locally from aggregate values;
            downloaded reports contain no individual invoice, wallet, or payer
            records. Sample size: {report.sampleSize} invoices.
          </p>
        </>
      )}
      <aside className="mt-4 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-200">Published industry context</h3>
        <p className="mt-1 text-sm text-gray-400">
          A U.S. EXIM Bank summary of a 2016 MarketInvoice study reported that{" "}
          {INDUSTRY_PAYMENT_REFERENCE.lateInvoicePercent}% of invoices were paid
          late and average lateness was {INDUSTRY_PAYMENT_REFERENCE.averageDaysLate} days
          ({INDUSTRY_PAYMENT_REFERENCE.smeAverageDaysLate} days for SMEs). This older,
          multi-country finding is context only; it is not directly comparable to
          on-chain completion rate or used to calculate the percentile rankings.
        </p>
        <a
          href={INDUSTRY_PAYMENT_REFERENCE.source}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-indigo-300 underline hover:text-indigo-200"
        >
          Source: U.S. EXIM Bank, May 11, 2017
        </a>
      </aside>
    </section>
  );
}
