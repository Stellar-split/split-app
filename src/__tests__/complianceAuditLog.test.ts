import {
  logComplianceEvent,
  getAllEvents,
  getEventById,
  clearComplianceLog,
  filterEvents,
  generateReport,
  exportToCsv,
  exportToJson,
  type ComplianceEvent,
} from '@/lib/complianceAuditLog';

beforeEach(() => {
  clearComplianceLog();
});

describe('complianceAuditLog', () => {
  describe('logging works', () => {
    it('logs a compliance event', () => {
      const event = logComplianceEvent({
        category: 'authentication',
        severity: 'info',
        actor: 'user-1',
        action: 'login',
        ipAddress: '127.0.0.1',
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.actor).toBe('user-1');
      expect(event.action).toBe('login');
    });

    it('stores events in the log', () => {
      logComplianceEvent({ category: 'payment', severity: 'info', actor: 'user-2', action: 'payment_initiated' });
      logComplianceEvent({ category: 'admin', severity: 'warning', actor: 'admin-1', action: 'settings_changed' });
      expect(getAllEvents()).toHaveLength(2);
    });

    it('retrieves event by id', () => {
      const event = logComplianceEvent({ category: 'export', severity: 'info', actor: 'user-3', action: 'data_export' });
      const found = getEventById(event.id);
      expect(found).toBeDefined();
      expect(found!.actor).toBe('user-3');
    });

    it('assigns unique ids to events', () => {
      const e1 = logComplianceEvent({ category: 'consent', severity: 'info', actor: 'u1', action: 'consent_given' });
      const e2 = logComplianceEvent({ category: 'consent', severity: 'info', actor: 'u2', action: 'consent_given' });
      expect(e1.id).not.toBe(e2.id);
    });
  });

  describe('tracking works', () => {
    it('tracks actions per actor', () => {
      logComplianceEvent({ category: 'data_access', severity: 'info', actor: 'alice', action: 'read_invoice' });
      logComplianceEvent({ category: 'data_modification', severity: 'warning', actor: 'alice', action: 'edit_invoice' });
      logComplianceEvent({ category: 'authentication', severity: 'info', actor: 'bob', action: 'login' });
      const all = getAllEvents();
      const aliceEvents = all.filter((e) => e.actor === 'alice');
      expect(aliceEvents).toHaveLength(2);
    });

    it('records all event fields', () => {
      const event = logComplianceEvent({
        category: 'payment',
        severity: 'critical',
        actor: 'system',
        action: 'fraud_flagged',
        resourceType: 'transaction',
        resourceId: 'tx-999',
        details: { amount: 10000 },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
      expect(event.resourceType).toBe('transaction');
      expect(event.resourceId).toBe('tx-999');
      expect(event.details?.amount).toBe(10000);
      expect(event.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('filtering works', () => {
    beforeEach(() => {
      const base = Date.now();
      logComplianceEvent({ category: 'authentication', severity: 'info', actor: 'alice', action: 'login', timestamp: base - 2000 });
      logComplianceEvent({ category: 'payment', severity: 'warning', actor: 'bob', action: 'payment_failed', timestamp: base - 1000 });
      logComplianceEvent({ category: 'admin', severity: 'critical', actor: 'alice', action: 'delete_user', timestamp: base });
    });

    it('filters by category', () => {
      const results = filterEvents({ category: 'payment' });
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('payment_failed');
    });

    it('filters by actor', () => {
      const results = filterEvents({ actor: 'alice' });
      expect(results).toHaveLength(2);
    });

    it('filters by severity', () => {
      const results = filterEvents({ severity: 'critical' });
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('delete_user');
    });

    it('filters by date range', () => {
      const now = Date.now();
      const results = filterEvents({ fromTimestamp: now - 1500, toTimestamp: now });
      expect(results).toHaveLength(2);
    });

    it('filters by search query', () => {
      const results = filterEvents({ searchQuery: 'alice' });
      expect(results).toHaveLength(2);
    });
  });

  describe('reports work', () => {
    it('generates a report for a time period', () => {
      const start = Date.now();
      logComplianceEvent({ category: 'payment', severity: 'info', actor: 'u1', action: 'pay' });
      logComplianceEvent({ category: 'admin', severity: 'warning', actor: 'u2', action: 'admin_action' });
      const report = generateReport(start - 1000, Date.now() + 1000);
      expect(report.totalEvents).toBe(2);
      expect(report.byCategory.payment).toBe(1);
      expect(report.byCategory.admin).toBe(1);
      expect(report.uniqueActors).toBe(2);
    });

    it('exports events as CSV', () => {
      logComplianceEvent({ category: 'export', severity: 'info', actor: 'exporter', action: 'csv_export' });
      const csv = exportToCsv(getAllEvents());
      expect(csv).toContain('id,timestamp');
      expect(csv).toContain('exporter');
      expect(csv).toContain('csv_export');
    });

    it('exports events as JSON', () => {
      logComplianceEvent({ category: 'consent', severity: 'info', actor: 'user', action: 'consent_revoked' });
      const json = exportToJson(getAllEvents());
      const parsed = JSON.parse(json) as ComplianceEvent[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].actor).toBe('user');
    });

    it('report includes top actors', () => {
      const start = Date.now() - 1000;
      logComplianceEvent({ category: 'data_access', severity: 'info', actor: 'power-user', action: 'read' });
      logComplianceEvent({ category: 'data_access', severity: 'info', actor: 'power-user', action: 'read' });
      logComplianceEvent({ category: 'data_access', severity: 'info', actor: 'regular', action: 'read' });
      const report = generateReport(start, Date.now() + 1000);
      expect(report.topActors[0].actor).toBe('power-user');
      expect(report.topActors[0].count).toBe(2);
    });
  });
});
