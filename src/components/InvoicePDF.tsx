import { formatAmount } from "@stellar-split/sdk";
import { t, formatDate, type Locale } from "@/lib/receiptI18n";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
  locale?: Locale;
}

/**
 * InvoicePDF — print-only invoice layout + "Download PDF" button.
 * The button is hidden in print view via print:hidden.
 * The #invoice-print section is shown only in print via the global @media print styles.
 */
export default function InvoicePDF({ invoice, total, locale = "en" }: Props) {
  const deadline = invoice.deadline > 0
    ? formatDate(new Date(invoice.deadline * 1000), locale)
    : t(locale, "noDeadline");

  return (
    <>
      {/* Trigger button — hidden when printing */}
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors print:hidden"
      >
        Download PDF
      </button>

      {/* Print-only content */}
      <div id="invoice-print" className="hidden print:block text-black bg-white p-8 text-sm leading-relaxed relative">
        {invoice.status !== "Released" && (
          <div className="fixed inset-0 pointer-events-none print:fixed print:inset-0 print:pointer-events-none z-0 flex items-center justify-center opacity-10">
            <div className="transform -rotate-45 text-9xl font-bold text-gray-800 whitespace-nowrap">DRAFT</div>
          </div>
        )}
        <div className="relative z-10">
        <h1 className="text-2xl font-bold mb-1">
          {t(locale, "invoice")} #{invoice.id}
        </h1>
        <p className="text-gray-500 mb-6">{t(locale, "stellarSplitInvoice")}</p>

        <table className="w-full mb-6 text-left border-collapse">
          <tbody>
            <tr className="border-b border-gray-200">
              <th className="py-1.5 pr-4 font-semibold w-32">{t(locale, "status")}</th>
              <td className="py-1.5">{invoice.status}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <th className="py-1.5 pr-4 font-semibold">{t(locale, "creator")}</th>
              <td className="py-1.5 font-mono break-all">{invoice.creator}</td>
            </tr>
            <tr className="border-b border-gray-200">
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
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-1.5 pr-4">{t(locale, "address")}</th>
              <th className="text-right py-1.5">{t(locale, "amount")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.recipients.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
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
