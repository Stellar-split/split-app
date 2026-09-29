import React, { useMemo } from 'react';

/**
 * Invoice impact storytelling UI.
 *
 * Renders a narrative breakdown of how an invoice's amount translates into
 * real-world impact, with a mobile-responsive layout and accessible markup.
 */

export interface InvoiceImpactStory {
  /** Short headline describing the overall impact. */
  headline: string;
  /** One or two sentence narrative summary. */
  summary: string;
  /** Individual impact metrics that make up the story. */
  metrics: InvoiceImpactMetric[];
}

export interface InvoiceImpactMetric {
  /** Stable identifier for the metric. */
  id: string;
  /** Human readable label, e.g. "Meals provided". */
  label: string;
  /** Numeric value for the metric. */
  value: number;
  /** Optional unit suffix, e.g. "meals", "hours". */
  unit?: string;
  /** Optional emoji or short glyph used as a visual marker. */
  icon?: string;
}

export interface InvoiceDetailProps {
  /** Invoice identifier shown in the header. */
  invoiceId: string;
  /** Total invoice amount in the smallest currency unit (e.g. cents). */
  amount: number;
  /** ISO 4217 currency code. Defaults to USD. */
  currency?: string;
  /** Optional pre-computed impact story. */
  story?: InvoiceImpactStory;
  /** Optional loading flag while the story is being fetched. */
  loading?: boolean;
  /** Optional error message to surface instead of the story. */
  error?: string | null;
}

const DEFAULT_CURRENCY = 'USD';

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function formatMetricValue(metric: InvoiceImpactMetric): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(metric.value);
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

/**
 * Derives a default impact story from the invoice amount when no story is
 * supplied. Keeps the UI useful even before a backend narrative is available.
 */
export function deriveImpactStory(amount: number): InvoiceImpactStory {
  const dollars = Math.max(0, amount) / 100;
  return {
    headline: 'Your invoice is making an impact',
    summary:
      'Every invoice you pay is converted into measurable outcomes. Here is how this one breaks down.',
    metrics: [
      {
        id: 'meals',
        label: 'Meals provided',
        value: Math.round(dollars * 4),
        unit: 'meals',
        icon: '\u{1F37D}\u{FE0F}',
      },
      {
        id: 'hours',
        label: 'Support hours funded',
        value: Math.round(dollars * 0.5 * 10) / 10,
        unit: 'hours',
        icon: '\u{23F1}\u{FE0F}',
      },
      {
        id: 'trees',
        label: 'Trees planted',
        value: Math.round(dollars * 0.2),
        unit: 'trees',
        icon: '\u{1F333}',
      },
    ],
  };
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  invoiceId,
  amount,
  currency = DEFAULT_CURRENCY,
  story,
  loading = false,
  error = null,
}) => {
  const resolvedStory = useMemo(
    () => story ?? deriveImpactStory(amount),
    [story, amount],
  );

  const formattedAmount = useMemo(
    () => formatCurrency(amount, currency),
    [amount, currency],
  );

  return (
    <section
      className="invoice-detail"
      aria-labelledby={`invoice-detail-heading-${invoiceId}`}
    >
      <header className="invoice-detail__header">
        <p className="invoice-detail__eyebrow">Invoice {invoiceId}</p>
        <h2
          id={`invoice-detail-heading-${invoiceId}`}
          className="invoice-detail__amount"
        >
          {formattedAmount}
        </h2>
      </header>

      {loading ? (
        <div
          className="invoice-detail__status"
          role="status"
          aria-live="polite"
        >
          Loading impact story\u2026
        </div>
      ) : error ? (
        <div className="invoice-detail__status invoice-detail__status--error" role="alert">
          {error}
        </div>
      ) : (
        <div className="invoice-detail__story">
          <h3 className="invoice-detail__headline">{resolvedStory.headline}</h3>
          <p className="invoice-detail__summary">{resolvedStory.summary}</p>

          <ul className="invoice-detail__metrics">
            {resolvedStory.metrics.map((metric) => (
              <li key={metric.id} className="invoice-detail__metric">
                {metric.icon ? (
                  <span
                    className="invoice-detail__metric-icon"
                    aria-hidden="true"
                  >
                    {metric.icon}
                  </span>
                ) : null}
                <span className="invoice-detail__metric-value">
                  {formatMetricValue(metric)}
                </span>
                <span className="invoice-detail__metric-label">
                  {metric.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default InvoiceDetail;
