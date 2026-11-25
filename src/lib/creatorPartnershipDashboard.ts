/**
 * Creator partnership metrics and analytics.
 *
 * A partnership is a collaboration between a creator and a partner on one or
 * more invoices. This module computes headline metrics, per-partner
 * collaboration stats, period-over-period trends, and CSV export.
 */

export interface PartnershipInvoice {
  invoiceId: string;
  partnerAddress: string;
  /** Gross invoice amount in the base unit. */
  amount: number;
  /** When the invoice was settled (epoch ms). */
  settledAt: number;
}

export interface PartnershipMetrics {
  totalPartnerships: number;
  activePartnerships: number;
  totalInvoices: number;
  totalVolume: number;
  averageDealSize: number;
}

export interface PartnerStat {
  partnerAddress: string;
  collaborations: number;
  volume: number;
  lastActiveAt: number;
}

export interface TrendPoint {
  /** Start of the period bucket (epoch ms). */
  periodStart: number;
  partnerships: number;
  volume: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketStart(timestamp: number, periodMs: number): number {
  return Math.floor(timestamp / periodMs) * periodMs;
}

/** Distinct partners the creator has collaborated with. */
export function countPartnerships(invoices: PartnershipInvoice[]): number {
  return new Set(invoices.map((i) => i.partnerAddress)).size;
}

/** Headline partnership metrics. */
export function computeMetrics(
  invoices: PartnershipInvoice[],
  now: number = Date.now(),
  activeWindowMs: number = 30 * DAY_MS
): PartnershipMetrics {
  const totalInvoices = invoices.length;
  const totalVolume = invoices.reduce((sum, i) => sum + i.amount, 0);
  const partners = new Set(invoices.map((i) => i.partnerAddress));
  // Distinct partners active within the window.
  const activeSet = new Set(
    invoices
      .filter((i) => now - i.settledAt <= activeWindowMs)
      .map((i) => i.partnerAddress)
  );

  return {
    totalPartnerships: partners.size,
    activePartnerships: activeSet.size,
    totalInvoices,
    totalVolume,
    averageDealSize: totalInvoices === 0 ? 0 : totalVolume / totalInvoices,
  };
}

/** Per-partner collaboration statistics, most active first. */
export function collaborationStats(
  invoices: PartnershipInvoice[]
): PartnerStat[] {
  const map = new Map<string, PartnerStat>();
  for (const inv of invoices) {
    const existing = map.get(inv.partnerAddress);
    if (existing) {
      existing.collaborations += 1;
      existing.volume += inv.amount;
      if (inv.settledAt > existing.lastActiveAt) {
        existing.lastActiveAt = inv.settledAt;
      }
    } else {
      map.set(inv.partnerAddress, {
        partnerAddress: inv.partnerAddress,
        collaborations: 1,
        volume: inv.amount,
        lastActiveAt: inv.settledAt,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.collaborations - a.collaborations ||
      a.partnerAddress.localeCompare(b.partnerAddress)
  );
}

/**
 * Build period-over-period trend points (partnerships + volume per bucket).
 */
export function buildTrends(
  invoices: PartnershipInvoice[],
  periodMs: number = DAY_MS,
  periods = 6,
  now: number = Date.now()
): TrendPoint[] {
  const currentBucket = bucketStart(now, periodMs);
  const points: TrendPoint[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    const periodStart = currentBucket - i * periodMs;
    const inBucket = invoices.filter(
      (inv) => bucketStart(inv.settledAt, periodMs) === periodStart
    );
    points.push({
      periodStart,
      partnerships: new Set(inBucket.map((i) => i.partnerAddress)).size,
      volume: inBucket.reduce((sum, i) => sum + i.amount, 0),
    });
  }
  return points;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Export partnership metrics as CSV text. */
export function exportMetricsCsv(metrics: PartnershipMetrics): string {
  const rows: (string | number)[][] = [
    ["Metric", "Value"],
    ["Total Partnerships", metrics.totalPartnerships],
    ["Active Partnerships", metrics.activePartnerships],
    ["Total Invoices", metrics.totalInvoices],
    ["Total Volume", metrics.totalVolume],
    ["Average Deal Size", metrics.averageDealSize],
  ];
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
}

/** Export per-partner collaboration stats as CSV text. */
export function exportStatsCsv(stats: PartnerStat[]): string {
  const rows: (string | number)[][] = [
    ["Partner", "Collaborations", "Volume", "Last Active"],
    ...stats.map((s) => [
      s.partnerAddress,
      s.collaborations,
      s.volume,
      new Date(s.lastActiveAt).toISOString(),
    ]),
  ];
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
}