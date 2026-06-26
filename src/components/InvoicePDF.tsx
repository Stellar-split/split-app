"use client";

import { useState } from "react";
import { formatAmount } from "@stellar-split/sdk";
import { t, formatDate, type Locale } from "@/lib/receiptI18n";
import type { Invoice } from "@stellar-split/sdk";
import { useTheme } from "@/contexts/ThemeContext";
import { getPDFThemeClasses, type ExportMode } from "@/lib/pdfTheme";

interface Props {
  invoice: Invoice;
  total: bigint;
  locale?: Locale;
}

export default function InvoicePDF({ invoice, total, locale = "en" }: Props) {
  const [exportMode, setExportMode] = useState<ExportMode>("print");
  const { resolvedTheme } = useTheme();
  const theme = getPDFThemeClasses(exportMode, resolvedTheme);

  const deadline = invoice.deadline > 0
    ? formatDate(new Date(invoice.deadline * 1000), locale)
    : t(locale, "noDeadline");

  return (
    <>
      {/* Mode selector + trigger button — hidden when printing */}
      <div className="flex items-center gap-2 print:hidden">
        <div className="inline-flex rounded-lg border border-gray-600 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setExportMode("print")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              exportMode === "print"
                ? "bg-indigo-600 text-white"
                : "bg-transparent text-gray-300 hover:bg-gray-700"
            }`}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setExportMode("screen")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              exportMode === "screen"
                ? "bg-indigo-600 text-white"
                : "bg-transparent text-gray-300 hover:bg-gray-700"
            }`}
          >
            Screen
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
        >
          Download PDF
        </button>
      </div>

      {/* Print-only content */}
      <div id="invoice-print" className={`hidden print:block p-8 text-sm leading-relaxed relative ${theme.container}`}>
        {invoice.status !== "Released" && (
          <div className="fixed inset-0 pointer-events-none print:fixed print:inset-0 print:pointer-events-none z-0 flex items-center justify-center opacity-10">
            <div className={`transform -rotate-45 text-9xl font-bold whitespace-nowrap ${theme.watermark}`}>DRAFT</div>
          </div>
        )}
        <div className="relative z-10">
        <h1 className="text-2xl font-bold mb-1">
          {t(locale, "invoice")} #{invoice.id}
        </h1>
        <p className={`${theme.subtitle} mb-6`}>{t(locale, "stellarSplitInvoice")}</p>

        <table className="w-full mb-6 text-left border-collapse">
          <tbody>
            <tr className={`border-b ${theme.borderRow}`}>
              <th className="py-1.5 pr-4 font-semibold w-32">{t(locale, "status")}</th>
              <td className="py-1.5">{invoice.status}</td>
            </tr>
            <tr className={`border-b ${theme.borderRow}`}>
              <th className="py-1.5 pr-4 font-semibold">{t(locale, "creator")}</th>
              <td className="py-1.5 font-mono break-all">{invoice.creator}</td>
            </tr>
            <tr className={`border-b ${theme.borderRow}`}>
              <th className="py-1.5 pr-4 font-semibold">{t(locale, "deadline")}</th>
              <td className="py-1.5">{deadline}</td>
            </tr>
            <tr>
              <th className="py-1.5 pr-4 font-semibold">{t(locale, "total")}</th>
              <td className="py-1.5">{formatAmount(total)} USDC</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-semibold text-base mb-2">{t(locale, "recipients")}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b-2 ${theme.borderHeaderRow}`}>
              <th className="text-left py-1.5 pr-4">{t(locale, "address")}</th>
              <th className="text-right py-1.5">{t(locale, "amount")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.recipients.map((r, i) => (
              <tr key={i} className={`border-b ${theme.recipientRow}`}>
                <td className="py-1.5 pr-4 font-mono break-all">{r.address}</td>
                <td className="py-1.5 text-right">{formatAmount(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
