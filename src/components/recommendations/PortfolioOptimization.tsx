"use client";

import { useMemo } from "react";
import { optimizePortfolio, type PortfolioInvoice, type TipSeverity } from "@/lib/portfolioOptimization";

interface Props {
  invoices: PortfolioInvoice[];
  /** Overridable for deterministic rendering. */
  now?: number;
}

const SEVERITY_STYLES: Record<TipSeverity, string> = {
  critical: "border-red-200 bg-red-50 text-red-900",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

export default function PortfolioOptimization({ invoices, now }: Props) {
  const tips = useMemo(() => optimizePortfolio(invoices, now), [invoices, now]);

  if (tips.length === 0) {
    return <p className="text-sm text-gray-500">Your invoice portfolio looks healthy — no recommendations right now.</p>;
  }

  return (
    <ul aria-label="Portfolio optimization recommendations" className="grid grid-cols-1 gap-2">
      {tips.map((t) => (
        <li key={t.id} className={`rounded-lg border p-3 text-sm ${SEVERITY_STYLES[t.severity]}`}>
          <span className="mr-2 text-xs font-semibold uppercase">{t.severity}</span>
          {t.message}
        </li>
      ))}
    </ul>
  );
}
