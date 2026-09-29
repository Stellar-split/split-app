import { useMemo, useState } from 'react';

export interface InvoiceImpactLineItem {
  id: string;
  label: string;
  amount: number;
  category?: string;
}

export interface InvoiceImpactStoryProps {
  invoiceNumber?: string;
  currency?: string;
  lineItems: InvoiceImpactLineItem[];
  totalAmount?: number;
  periodLabel?: string;
  onShare?: (summary: string) => void;
}

interface ImpactNarrative {
  headline: string;
  summary: string;
  highlights: string[];
}

const DEFAULT_CURRENCY = 'USD';

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function buildNarrative(
  lineItems: InvoiceImpactLineItem[],
  total: number,
  currency: string,
  periodLabel?: string,
): ImpactNarrative {
  const sorted = [...lineItems].sort((a, b) => b.amount - a.amount);
  const top = sorted[0];
  const period = periodLabel ? ` for ${periodLabel}` : '';

  if (!top || total <= 0) {
    return {
      headline: 'Your invoice is ready',
      summary: `No billable impact was recorded${period}.`,
      highlights: [],
    };
  }

  const share = Math.round((top.amount / total) * 100);
  const headline = `${top.label} drove ${share}% of your invoice`;
  const summary = `Your total of ${formatCurrency(total, currency)}${period} was shaped mostly by ${top.label}.`;

  const highlights = sorted.slice(0, 3).map((item) => {
    const itemShare = total > 0 ? Math.round((item.amount / total) * 100) : 0;
    return `${item.label}: ${formatCurrency(item.amount, currency)} (${itemShare}%)`;
  });

  return { headline, summary, highlights };
}

export default function InvoiceImpactStory({
  invoiceNumber,
  currency = DEFAULT_CURRENCY,
  lineItems,
  totalAmount,
  periodLabel,
  onShare,
}: InvoiceImpactStoryProps) {
  const [expanded, setExpanded] = useState(false);

  const total = useMemo(() => {
    if (typeof totalAmount === 'number') {
      return totalAmount;
    }
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  }, [lineItems, totalAmount]);

  const narrative = useMemo(
    () => buildNarrative(lineItems, total, currency, periodLabel),
    [lineItems, total, currency, periodLabel],
  );

  const sorted = useMemo(
    () => [...lineItems].sort((a, b) => b.amount - a.amount),
    [lineItems],
  );

  const handleShare = () => {
    if (!onShare) return;
    const text = [narrative.headline, narrative.summary, ...narrative.highlights].join('\n');
    onShare(text);
  };

  return (
    <section
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      aria-label="Invoice impact story"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Invoice impact
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
            {narrative.headline}
          </h2>
          {invoiceNumber ? (
            <p className="mt-1 text-xs text-slate-500">Invoice {invoiceNumber}</p>
          ) : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-xl font-bold text-slate-900 sm:text-2xl">
            {formatCurrency(total, currency)}
          </p>
        </div>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-slate-600">{narrative.summary}</p>

      {narrative.highlights.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {narrative.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span aria-hidden="true" className="mt-0.5 text-indigo-500">
                •
              </span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide breakdown' : 'View breakdown'}
        </button>
        {onShare ? (
          <button
            type="button"
            onClick={handleShare}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 sm:w-auto"
          >
            Share story
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                <th scope="col" className="py-2 pr-3 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-800">{item.label}</td>
                  <td className="py-2 pr-3 text-slate-500">{item.category ?? '—'}</td>
                  <td className="py-2 text-right text-slate-800">
                    {formatCurrency(item.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
