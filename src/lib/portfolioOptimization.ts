export type PortfolioInvoiceStatus = "open" | "funded" | "paid" | "expired" | "cancelled";

export interface PortfolioInvoice {
  id: string;
  title: string;
  amount: number;
  status: PortfolioInvoiceStatus;
  recipients: string[];
  createdAt: number; // ms since epoch
  dueAt?: number; // ms since epoch
}

export type TipKind = "overdue" | "expiring" | "stale" | "concentration" | "small-invoices" | "cancellations";
export type TipSeverity = "critical" | "warning" | "info";

export interface OptimizationTip {
  id: TipKind;
  severity: TipSeverity;
  message: string;
  invoiceIds: string[];
}

const DAY_MS = 86_400_000;
const EXPIRING_WITHIN_DAYS = 3;
const STALE_AFTER_DAYS = 30;
const CONCENTRATION_SHARE = 0.5;
const CONCENTRATION_MIN_INVOICES = 3;
const SMALL_AMOUNT = 10;
const SMALL_MIN_COUNT = 3;
const CANCEL_RATE = 0.3;
const CANCEL_MIN_INVOICES = 5;

const SEVERITY_ORDER: Record<TipSeverity, number> = { critical: 0, warning: 1, info: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Suggests ways to tidy up and de-risk an invoice portfolio, most urgent first. */
export function optimizePortfolio(invoices: PortfolioInvoice[], now: number = Date.now()): OptimizationTip[] {
  const tips: OptimizationTip[] = [];
  const open = invoices.filter((i) => i.status === "open");

  const overdue = open.filter((i) => i.dueAt !== undefined && i.dueAt < now);
  if (overdue.length) {
    tips.push({
      id: "overdue",
      severity: "critical",
      message: `${plural(overdue.length, "open invoice")} past due — extend the deadline or cancel.`,
      invoiceIds: overdue.map((i) => i.id),
    });
  }

  const expiring = open.filter(
    (i) => i.dueAt !== undefined && i.dueAt >= now && i.dueAt - now <= EXPIRING_WITHIN_DAYS * DAY_MS,
  );
  if (expiring.length) {
    tips.push({
      id: "expiring",
      severity: "warning",
      message: `${plural(expiring.length, "invoice")} due within ${EXPIRING_WITHIN_DAYS} days — send a reminder.`,
      invoiceIds: expiring.map((i) => i.id),
    });
  }

  const stale = open.filter((i) => i.dueAt === undefined && now - i.createdAt > STALE_AFTER_DAYS * DAY_MS);
  if (stale.length) {
    tips.push({
      id: "stale",
      severity: "warning",
      message: `${plural(stale.length, "open invoice")} older than ${STALE_AFTER_DAYS} days with no deadline — set one or close it.`,
      invoiceIds: stale.map((i) => i.id),
    });
  }

  const active = invoices.filter((i) => i.status === "open" || i.status === "funded");
  if (active.length >= CONCENTRATION_MIN_INVOICES) {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const inv of active) {
      if (!inv.recipients.length) continue;
      const share = inv.amount / inv.recipients.length;
      grand += inv.amount;
      for (const r of inv.recipients) totals.set(r, (totals.get(r) ?? 0) + share);
    }
    let topRecipient: string | undefined;
    let topTotal = 0;
    totals.forEach((total, r) => {
      if (total > topTotal) {
        topRecipient = r;
        topTotal = total;
      }
    });
    if (topRecipient !== undefined && grand > 0 && topTotal / grand > CONCENTRATION_SHARE) {
      const pct = Math.round((topTotal / grand) * 100);
      tips.push({
        id: "concentration",
        severity: "info",
        message: `${pct}% of active value goes to one recipient (${topRecipient}) — consider diversifying.`,
        invoiceIds: active.filter((i) => i.recipients.includes(topRecipient as string)).map((i) => i.id),
      });
    }
  }

  const small = open.filter((i) => i.amount < SMALL_AMOUNT);
  if (small.length >= SMALL_MIN_COUNT) {
    tips.push({
      id: "small-invoices",
      severity: "info",
      message: `${plural(small.length, "open invoice")} under ${SMALL_AMOUNT} — batch them to save on fees.`,
      invoiceIds: small.map((i) => i.id),
    });
  }

  const cancelled = invoices.filter((i) => i.status === "cancelled");
  if (invoices.length >= CANCEL_MIN_INVOICES && cancelled.length / invoices.length > CANCEL_RATE) {
    tips.push({
      id: "cancellations",
      severity: "warning",
      message: `${Math.round((cancelled.length / invoices.length) * 100)}% of your invoices were cancelled — review your templates and deadlines.`,
      invoiceIds: cancelled.map((i) => i.id),
    });
  }

  return tips.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
