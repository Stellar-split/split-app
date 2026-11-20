'use client';
import { useMemo } from 'react';
import {
  generateComplianceReport,
  computeAuditAnalytics,
  auditEntriesToCsv,
  auditEntriesToJson,
  type AuditEntry,
  type RetentionPolicy,
} from '@/lib/auditLog';

interface Props {
  entries: AuditEntry[];
  periodFrom: number;
  periodTo: number;
  retentionPolicy?: RetentionPolicy;
}

export default function ComplianceReport({ entries, periodFrom, periodTo, retentionPolicy = '1y' }: Props) {
  const report = useMemo(
    () => generateComplianceReport(entries, periodFrom, periodTo, retentionPolicy),
    [entries, periodFrom, periodTo, retentionPolicy]
  );
  const analytics = useMemo(() => computeAuditAnalytics(report.entries), [report.entries]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([auditEntriesToCsv(report.entries)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'compliance-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([auditEntriesToJson(report.entries)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'compliance-report.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Compliance report" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Compliance Report</h2>
          <p className="text-xs text-gray-500">
            {new Date(periodFrom).toLocaleDateString()} – {new Date(periodTo).toLocaleDateString()}
            {' · '}Retention: {retentionPolicy}
            {' · '}Generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={report.totalEvents === 0}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={exportJson}
            disabled={report.totalEvents === 0}
            className="rounded-lg bg-gray-700 hover:bg-gray-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Events', value: report.totalEvents },
          { label: 'Unique Actors', value: report.uniqueActors },
          { label: 'Most Active', value: analytics.mostActiveActor ? analytics.mostActiveActor.slice(0, 8) + '…' : '—' },
          { label: 'Top Action', value: analytics.mostCommonAction ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-bold truncate" title={String(value)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
        <h3 className="text-sm font-semibold mb-3">Events by Category</h3>
        <div className="space-y-2">
          {Object.entries(report.byCategory).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-20 text-xs capitalize text-gray-400">{cat}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: report.totalEvents ? `${(count / report.totalEvents) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Entries table */}
      {report.totalEvents === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No events in this period.</p>
      ) : (
        <ul className="divide-y divide-gray-800 rounded-xl border border-gray-700 text-sm">
          {report.entries.slice(0, 50).map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <time className="shrink-0 text-xs text-gray-500 sm:w-40" dateTime={new Date(e.timestamp).toISOString()}>
                {new Date(e.timestamp).toLocaleString()}
              </time>
              <span className="w-fit rounded-full bg-gray-800 px-2 py-0.5 text-xs capitalize">{e.category}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.action}</p>
                {e.details && <p className="text-xs text-gray-500">{e.details}</p>}
              </div>
              <span className="font-mono text-xs text-gray-500 truncate sm:max-w-[8rem]" title={e.actor}>{e.actor}</span>
            </li>
          ))}
          {report.totalEvents > 50 && (
            <li className="px-4 py-3 text-center text-xs text-gray-500">
              Showing 50 of {report.totalEvents} events. Export for full data.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
