"use client";

import { useMemo } from "react";
import { recommendInvoices, type InvoiceRecommendation, type PastInvoice } from "@/lib/invoiceRecommendations";

interface Props {
  history: PastInvoice[];
  limit?: number;
  onApply?: (rec: InvoiceRecommendation) => void;
}

export default function InvoiceRecommendations({ history, limit, onApply }: Props) {
  const recs = useMemo(() => recommendInvoices(history, limit), [history, limit]);

  if (recs.length === 0) {
    return <p className="text-sm text-gray-500">Create a few invoices to get recommendations.</p>;
  }

  return (
    <ul aria-label="Invoice recommendations" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {recs.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{r.label}</p>
            <p className="truncate text-sm font-medium" title={r.value}>
              {r.value}
            </p>
          </div>
          {onApply && (
            <button
              type="button"
              onClick={() => onApply(r)}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
            >
              Use
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
