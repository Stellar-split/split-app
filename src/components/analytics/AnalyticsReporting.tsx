"use client";

/**
 * Analytics Reporting Dashboard Component (#1170)
 */

import React, { useState, useMemo } from 'react';
import {
  filterReportEvents,
  computeSummary,
  generateAnalyticsReport,
  exportReportToCsv,
  exportReportToJson,
  type ReportEvent,
  type ReportFilter,
  type AnalyticsSummary,
} from '@/lib/analyticsReporting';

interface AnalyticsReportingProps {
  events: ReportEvent[];
  onExport?: (format: 'csv' | 'json', data: string) => void;
}

export default function AnalyticsReporting({ events, onExport }: AnalyticsReportingProps) {
  const [filter, setFilter] = useState<ReportFilter>({});
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const activeFilter: ReportFilter = useMemo(() => ({
    eventType: eventTypeFilter || undefined,
    userId: userIdFilter || undefined,
    fromTimestamp: fromDate ? new Date(fromDate).getTime() : undefined,
    toTimestamp: toDate ? new Date(toDate).getTime() : undefined,
  }), [eventTypeFilter, userIdFilter, fromDate, toDate]);

  const filtered = useMemo(() => filterReportEvents(events, activeFilter), [events, activeFilter]);
  const summary: AnalyticsSummary = useMemo(() => computeSummary(filtered), [filtered]);

  function handleExport(format: 'csv' | 'json') {
    const data = format === 'csv' ? exportReportToCsv(filtered) : exportReportToJson(filtered);
    if (onExport) {
      onExport(format, data);
    } else {
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div data-testid="analytics-reporting">
      <h2>Analytics Reporting</h2>

      {/* Filters */}
      <div data-testid="analytics-filters">
        <input
          aria-label="Filter by event type"
          placeholder="Event type"
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
        />
        <input
          aria-label="Filter by user ID"
          placeholder="User ID"
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
        />
        <input
          aria-label="From date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          aria-label="To date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      {/* Summary */}
      <div data-testid="analytics-summary">
        <div data-testid="total-events">Total Events: {summary.totalEvents}</div>
        <div data-testid="unique-users">Unique Users: {summary.uniqueUsers}</div>
        <div data-testid="total-value">Total Value: {summary.totalValue}</div>
        <div data-testid="avg-value">Avg Value: {summary.avgValue.toFixed(2)}</div>
      </div>

      {/* Event type breakdown */}
      <div data-testid="event-type-breakdown">
        {Object.entries(summary.byEventType).map(([type, count]) => (
          <div key={type} data-testid={`event-type-${type}`}>
            {type}: {count}
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div data-testid="export-controls">
        <button onClick={() => handleExport('csv')}>Export CSV</button>
        <button onClick={() => handleExport('json')}>Export JSON</button>
      </div>

      {/* Events table */}
      <div data-testid="events-table">
        {filtered.map((event) => (
          <div key={event.id} data-testid={`event-row-${event.id}`}>
            <span>{event.eventType}</span>
            <span>{event.userId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
