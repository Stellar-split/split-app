import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalyticsReporting from '@/components/analytics/AnalyticsReporting';
import {
  filterReportEvents,
  computeSummary,
  generateAnalyticsReport,
  exportReportToCsv,
  exportReportToJson,
  type ReportEvent,
} from '@/lib/analyticsReporting';

const sampleEvents: ReportEvent[] = [
  { id: 'e1', userId: 'u1', eventType: 'page_view', timestamp: 1700000000000, value: 1 },
  { id: 'e2', userId: 'u2', eventType: 'payment', timestamp: 1700000001000, value: 100 },
  { id: 'e3', userId: 'u1', eventType: 'payment', timestamp: 1700000002000, value: 50 },
  { id: 'e4', userId: 'u3', eventType: 'login', timestamp: 1700000003000 },
  { id: 'e5', userId: 'u2', eventType: 'page_view', timestamp: 1700000004000, value: 1 },
];

describe('analyticsReporting', () => {
  describe('reports generate', () => {
    it('generates a report with correct total events', () => {
      const report = generateAnalyticsReport(sampleEvents);
      expect(report.summary.totalEvents).toBe(5);
    });

    it('generates a report with correct unique users', () => {
      const report = generateAnalyticsReport(sampleEvents);
      expect(report.summary.uniqueUsers).toBe(3);
    });

    it('computes correct event type breakdown', () => {
      const summary = computeSummary(sampleEvents);
      expect(summary.byEventType.page_view).toBe(2);
      expect(summary.byEventType.payment).toBe(2);
      expect(summary.byEventType.login).toBe(1);
    });

    it('computes correct total and avg value', () => {
      const summary = computeSummary(sampleEvents);
      expect(summary.totalValue).toBe(152); // 1+100+50+1
      expect(summary.avgValue).toBeCloseTo(38, 0); // 152/4
    });

    it('includes generatedAt timestamp', () => {
      const report = generateAnalyticsReport(sampleEvents);
      expect(report.generatedAt).toBeDefined();
      expect(report.generatedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('analytics display', () => {
    it('renders the analytics reporting component', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      expect(screen.getByTestId('analytics-reporting')).toBeInTheDocument();
    });

    it('displays total events', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      expect(screen.getByTestId('total-events')).toHaveTextContent('5');
    });

    it('displays unique users', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      expect(screen.getByTestId('unique-users')).toHaveTextContent('3');
    });

    it('renders event type breakdown', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      expect(screen.getByTestId('event-type-breakdown')).toBeInTheDocument();
    });

    it('shows export controls', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  describe('filters work', () => {
    it('filters by event type', () => {
      const filtered = filterReportEvents(sampleEvents, { eventType: 'payment' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.eventType === 'payment')).toBe(true);
    });

    it('filters by userId', () => {
      const filtered = filterReportEvents(sampleEvents, { userId: 'u1' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.userId === 'u1')).toBe(true);
    });

    it('filters by date range', () => {
      const filtered = filterReportEvents(sampleEvents, {
        fromTimestamp: 1700000001000,
        toTimestamp: 1700000002000,
      });
      expect(filtered).toHaveLength(2);
    });

    it('applies filter via UI input', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      const input = screen.getByLabelText('Filter by event type');
      fireEvent.change(input, { target: { value: 'payment' } });
      // After filtering, only 2 payment events should be shown
      expect(screen.getByTestId('total-events')).toHaveTextContent('2');
    });

    it('applies user filter via UI input', () => {
      render(<AnalyticsReporting events={sampleEvents} />);
      const input = screen.getByLabelText('Filter by user ID');
      fireEvent.change(input, { target: { value: 'u1' } });
      expect(screen.getByTestId('total-events')).toHaveTextContent('2');
    });
  });

  describe('exports work', () => {
    it('exports events to CSV', () => {
      const csv = exportReportToCsv(sampleEvents);
      expect(csv).toContain('id,userId,eventType,timestamp,value');
      expect(csv).toContain('page_view');
      expect(csv).toContain('payment');
    });

    it('exports events to JSON', () => {
      const json = exportReportToJson(sampleEvents);
      const parsed = JSON.parse(json) as ReportEvent[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(5);
    });

    it('calls onExport with CSV data when export CSV button clicked', () => {
      const onExport = vi.fn();
      render(<AnalyticsReporting events={sampleEvents} onExport={onExport} />);
      fireEvent.click(screen.getByText('Export CSV'));
      expect(onExport).toHaveBeenCalledWith('csv', expect.stringContaining('id,userId'));
    });

    it('calls onExport with JSON data when export JSON button clicked', () => {
      const onExport = vi.fn();
      render(<AnalyticsReporting events={sampleEvents} onExport={onExport} />);
      fireEvent.click(screen.getByText('Export JSON'));
      expect(onExport).toHaveBeenCalledWith('json', expect.stringContaining('['));
    });
  });
});
