import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
  filterAuditEntries,
  generateComplianceReport,
  computeAuditAnalytics,
  enforceRetentionPolicy,
  searchAuditEntries,
  auditEntriesToCsv,
  auditEntriesToJson,
  type AuditEntry,
  type RetentionPolicy,
} from '@/lib/auditLog';

// In-memory audit store for server-side events
const serverAuditLog: AuditEntry[] = [];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'list';

  if (action === 'list') {
    const q = searchParams.get('q') ?? '';
    const category = searchParams.get('category') as AuditEntry['category'] | 'all' | null;
    const from = searchParams.get('from') ? Number(searchParams.get('from')) : undefined;
    const to = searchParams.get('to') ? Number(searchParams.get('to')) : undefined;
    const filtered = filterAuditEntries(serverAuditLog, { query: q, category: category ?? 'all', from, to });
    return NextResponse.json({ entries: filtered, total: filtered.length });
  }

  if (action === 'analytics') {
    const analytics = computeAuditAnalytics(serverAuditLog);
    return NextResponse.json({ analytics });
  }

  if (action === 'report') {
    const from = Number(searchParams.get('from') ?? Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = Number(searchParams.get('to') ?? Date.now());
    const policy = (searchParams.get('retention') ?? '1y') as RetentionPolicy;
    const report = generateComplianceReport(serverAuditLog, from, to, policy);
    return NextResponse.json({ report });
  }

  if (action === 'search') {
    const q = searchParams.get('q') ?? '';
    return NextResponse.json({ entries: searchAuditEntries(serverAuditLog, q) });
  }

  if (action === 'export') {
    const format = searchParams.get('format') ?? 'csv';
    const all = filterAuditEntries(serverAuditLog);
    if (format === 'json') {
      return new Response(auditEntriesToJson(all), {
        headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="audit-log.json"' },
      });
    }
    return new Response(auditEntriesToCsv(all), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit-log.csv"' },
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { action } = body;

  if (action === 'log') {
    const entry = body.entry as Partial<AuditEntry> | undefined;
    if (!entry?.id || !entry?.actor || !entry?.action || !entry?.category) {
      return NextResponse.json({ error: 'entry.id, actor, action and category are required' }, { status: 400 });
    }
    const full: AuditEntry = {
      id: entry.id,
      timestamp: entry.timestamp ?? Date.now(),
      actor: entry.actor,
      action: entry.action,
      category: entry.category,
      target: entry.target,
      details: entry.details,
    };
    serverAuditLog.push(full);
    return NextResponse.json({ logged: true, id: full.id });
  }

  if (action === 'enforce_retention') {
    const policy = (body.policy ?? '1y') as RetentionPolicy;
    const before = serverAuditLog.length;
    const kept = enforceRetentionPolicy(serverAuditLog, policy);
    serverAuditLog.length = 0;
    serverAuditLog.push(...kept);
    return NextResponse.json({ before, after: serverAuditLog.length, removed: before - serverAuditLog.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
