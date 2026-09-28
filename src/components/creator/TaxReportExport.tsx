"use client";

import { useState } from "react";
import { buildTaxReportCsv, summarizeTaxYear, type TaxablePayment } from "@/lib/creatorTaxReport";

interface Props {
  payments: TaxablePayment[];
}

export default function TaxReportExport({ payments }: Props) {
  const years = Array.from(new Set(payments.map((p) => new Date(p.paidAt).getUTCFullYear()))).sort((a, b) => b - a);
  const [year, setYear] = useState(years[0] ?? new Date().getUTCFullYear());
  const summary = summarizeTaxYear(payments, year);

  const handleExport = () => {
    const blob = new Blob([buildTaxReportCsv(payments, year)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Tax report export" className="w-full rounded-lg border p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Tax report</h3>
        <div className="flex gap-2">
          <select
            aria-label="Tax year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border px-2 py-1 text-sm"
          >
            {(years.length ? years : [year]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={summary.count === 0}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-gray-500">Payments</dt><dd>{summary.count}</dd></div>
        <div><dt className="text-gray-500">Gross</dt><dd>{summary.gross}</dd></div>
        <div><dt className="text-gray-500">Fees</dt><dd>{summary.fees}</dd></div>
        <div><dt className="text-gray-500">Net</dt><dd>{summary.net}</dd></div>
      </dl>
    </section>
  );
}
