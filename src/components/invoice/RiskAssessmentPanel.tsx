"use client";

import { assessInvoiceRisk, type RiskInput, type RiskLevel } from "@/lib/invoiceRiskAssessment";

const LEVEL_STYLES: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

export default function RiskAssessmentPanel(props: RiskInput) {
  const { score, level, factors } = assessInvoiceRisk(props);
  return (
    <section aria-label="Risk assessment" className="w-full rounded-lg border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Risk assessment</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${LEVEL_STYLES[level]}`}>
          {level} risk · {score}/100
        </span>
      </div>
      {factors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {factors.map((f) => (
            <li key={f.id} className="flex justify-between gap-4">
              <span>{f.label}</span>
              <span className="text-gray-500">+{f.points}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No risk factors detected.</p>
      )}
    </section>
  );
}
