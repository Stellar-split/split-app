import { detectSuspiciousActivity, type ActivityEvent, type SuspiciousActivityAlert } from "@/lib/suspiciousActivity";

export type SecurityEventKind = "failed_auth" | "permission_change" | "large_payment" | "link_shared" | "export";

export interface InvoiceSecurityEvent {
  id: string;
  invoiceId: string;
  kind: SecurityEventKind;
  timestamp: number;
}

export type SecurityLevel = "good" | "attention" | "at_risk";

export interface InvoiceSecuritySummary {
  /** 0 (worst) – 100 (best). */
  score: number;
  level: SecurityLevel;
  countsByKind: Record<SecurityEventKind, number>;
  /** Invoices ranked by accumulated risk weight, highest first. */
  riskiestInvoices: { invoiceId: string; risk: number; events: number }[];
  alerts: SuspiciousActivityAlert[];
}

export const EVENT_WEIGHTS: Record<SecurityEventKind, number> = {
  failed_auth: 5,
  permission_change: 3,
  large_payment: 10,
  link_shared: 2,
  export: 1,
};

const ALERT_WEIGHTS = { high: 15, medium: 8, low: 3 } as const;

export function levelForScore(score: number): SecurityLevel {
  if (score >= 80) return "good";
  if (score >= 50) return "attention";
  return "at_risk";
}

export function summarizeInvoiceSecurity(
  events: InvoiceSecurityEvent[],
  activity: ActivityEvent[] = [],
  topN = 5,
): InvoiceSecuritySummary {
  const countsByKind: Record<SecurityEventKind, number> = {
    failed_auth: 0,
    permission_change: 0,
    large_payment: 0,
    link_shared: 0,
    export: 0,
  };
  const perInvoice = new Map<string, { risk: number; events: number }>();
  let penalty = 0;

  for (const event of events) {
    countsByKind[event.kind] += 1;
    const weight = EVENT_WEIGHTS[event.kind];
    penalty += weight;
    const entry = perInvoice.get(event.invoiceId) ?? { risk: 0, events: 0 };
    perInvoice.set(event.invoiceId, { risk: entry.risk + weight, events: entry.events + 1 });
  }

  const alerts = detectSuspiciousActivity(activity);
  for (const alert of alerts) penalty += ALERT_WEIGHTS[alert.severity];

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const riskiestInvoices = [...perInvoice.entries()]
    .map(([invoiceId, v]) => ({ invoiceId, ...v }))
    .sort((a, b) => b.risk - a.risk || a.invoiceId.localeCompare(b.invoiceId))
    .slice(0, topN);

  return { score, level: levelForScore(score), countsByKind, riskiestInvoices, alerts };
}
