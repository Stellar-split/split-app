import React, { useMemo } from 'react';
import type { InvoiceBundle } from '../services/bundleService';

interface BundleAnalyticsPanelProps {
  bundles: InvoiceBundle[];
  className?: string;
}

interface BundleAnalytics {
  bundleId: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  completionRate: number;
  statusBreakdown: Record<string, number>;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

const computeAnalytics = (bundle: InvoiceBundle): BundleAnalytics => {
  const invoices = bundle.invoices ?? [];
  const invoiceCount = invoices.length;

  let totalAmount = 0;
  let paidAmount = 0;
  const statusBreakdown: Record<string, number> = {};

  for (const invoice of invoices) {
    const amount = typeof invoice.amount === 'number' ? invoice.amount : 0;
    totalAmount += amount;

    const status = invoice.status ?? 'unknown';
    statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;

    if (status === 'paid') {
      paidAmount += amount;
    }
  }

  const completionRate = totalAmount > 0 ? paidAmount / totalAmount : 0;

  return {
    bundleId: bundle.id,
    name: bundle.name ?? `Bundle ${bundle.id}`,
    invoiceCount,
    totalAmount,
    paidAmount,
    completionRate,
    statusBreakdown,
  };
};

const BundleAnalyticsPanel: React.FC<BundleAnalyticsPanelProps> = ({
  bundles,
  className,
}) => {
  const analytics = useMemo<BundleAnalytics[]>(() => {
    if (!Array.isArray(bundles)) {
      return [];
    }
    return bundles.map(computeAnalytics);
  }, [bundles]);

  const totals = useMemo(() => {
    return analytics.reduce(
      (acc, item) => {
        acc.invoiceCount += item.invoiceCount;
        acc.totalAmount += item.totalAmount;
        acc.paidAmount += item.paidAmount;
        return acc;
      },
      { invoiceCount: 0, totalAmount: 0, paidAmount: 0 },
    );
  }, [analytics]);

  const overallCompletionRate =
    totals.totalAmount > 0 ? totals.paidAmount / totals.totalAmount : 0;

  if (analytics.length === 0) {
    return (
      <div className={className} data-testid="bundle-analytics-panel">
        <p className="bundle-analytics-empty">No bundle analytics available.</p>
      </div>
    );
  }

  return (
    <div className={className} data-testid="bundle-analytics-panel">
      <header className="bundle-analytics-header">
        <h2>Bundle Analytics</h2>
        <div className="bundle-analytics-summary" data-testid="bundle-analytics-summary">
          <span>
            Bundles: <strong>{analytics.length}</strong>
          </span>
          <span>
            Invoices: <strong>{totals.invoiceCount}</strong>
          </span>
          <span>
            Total: <strong>{formatCurrency(totals.totalAmount)}</strong>
          </span>
          <span>
            Paid: <strong>{formatCurrency(totals.paidAmount)}</strong>
          </span>
          <span>
            Completion: <strong>{formatPercent(overallCompletionRate)}</strong>
          </span>
        </div>
      </header>

      <table className="bundle-analytics-table">
        <thead>
          <tr>
            <th scope="col">Bundle</th>
            <th scope="col">Invoices</th>
            <th scope="col">Total Amount</th>
            <th scope="col">Paid Amount</th>
            <th scope="col">Completion Rate</th>
            <th scope="col">Status Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {analytics.map((item) => (
            <tr key={item.bundleId} data-testid={`bundle-analytics-row-${item.bundleId}`}>
              <td>{item.name}</td>
              <td>{item.invoiceCount}</td>
              <td>{formatCurrency(item.totalAmount)}</td>
              <td>{formatCurrency(item.paidAmount)}</td>
              <td>{formatPercent(item.completionRate)}</td>
              <td>
                <ul className="bundle-analytics-status-list">
                  {Object.entries(item.statusBreakdown).map(([status, count]) => (
                    <li key={status}>
                      <span className={`bundle-analytics-status bundle-analytics-status-${status}`}>
                        {status}
                      </span>
                      : {count}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BundleAnalyticsPanel;