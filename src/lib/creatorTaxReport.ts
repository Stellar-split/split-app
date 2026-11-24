export interface TaxablePayment {
  invoiceId: string;
  title: string;
  /** ISO date the payment settled. */
  paidAt: string;
  amount: number;
  fee: number;
  asset: string;
  /** Jurisdiction code (e.g. "US-CA", "EU-DE"). Defaults to the default jurisdiction. */
  jurisdiction?: string;
  /** Whether the payment is exempt from tax. */
  exempt?: boolean;
  /** Reason for the exemption, recorded in reports. */
  exemptionReason?: string;
}

export interface TaxJurisdiction {
  /** Jurisdiction code, matched case-insensitively against payments. */
  code: string;
  /** Human readable name. */
  name: string;
  /** Tax rate as a percentage of the taxable amount (e.g. 8.25 for 8.25%). */
  ratePercent: number;
}

export interface TaxReportSummary {
  year: number;
  gross: number;
  fees: number;
  net: number;
  count: number;
  /** Tax computed on the net (gross minus fees) taxable amount. */
  tax: number;
  /** Net amount after fees and tax. */
  afterTax: number;
  /** Gross amount excluded from tax by exemptions. */
  exemptGross: number;
  /** Per-jurisdiction breakdown, sorted by jurisdiction code. */
  jurisdictions: TaxJurisdictionSummary[];
}

export interface TaxJurisdictionSummary {
  jurisdiction: string;
  name: string;
  ratePercent: number;
  gross: number;
  fees: number;
  taxable: number;
  tax: number;
  count: number;
}

export const DEFAULT_JURISDICTION = "DEFAULT";

export const DEFAULT_JURISDICTIONS: TaxJurisdiction[] = [
  { code: DEFAULT_JURISDICTION, name: "Default", ratePercent: 0 },
];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCode(code: string | undefined): string {
  return (code ?? DEFAULT_JURISDICTION).trim().toUpperCase() || DEFAULT_JURISDICTION;
}

export function filterByTaxYear(payments: TaxablePayment[], year: number): TaxablePayment[] {
  return payments.filter((p) => new Date(p.paidAt).getUTCFullYear() === year);
}

export function resolveJurisdiction(
  code: string | undefined,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS
): TaxJurisdiction {
  const normalized = normalizeCode(code);
  return (
    jurisdictions.find((j) => normalizeCode(j.code) === normalized) ?? {
      code: normalized,
      name: normalized,
      ratePercent: 0,
    }
  );
}

/** Tax owed on a single payment, computed on the net (gross minus fee) amount. */
export function calculatePaymentTax(
  payment: TaxablePayment,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS
): number {
  if (payment.exempt) return 0;
  const { ratePercent } = resolveJurisdiction(payment.jurisdiction, jurisdictions);
  const taxable = Math.max(0, payment.amount - payment.fee);
  return round2((taxable * ratePercent) / 100);
}

export function summarizeTaxYear(
  payments: TaxablePayment[],
  year: number,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS
): TaxReportSummary {
  const rows = filterByTaxYear(payments, year);
  const gross = round2(rows.reduce((s, p) => s + p.amount, 0));
  const fees = round2(rows.reduce((s, p) => s + p.fee, 0));
  const exemptGross = round2(rows.filter((p) => p.exempt).reduce((s, p) => s + p.amount, 0));

  const byJurisdiction = new Map<string, TaxJurisdictionSummary>();
  for (const p of rows) {
    const j = resolveJurisdiction(p.jurisdiction, jurisdictions);
    const key = normalizeCode(j.code);
    const entry =
      byJurisdiction.get(key) ??
      { jurisdiction: key, name: j.name, ratePercent: j.ratePercent, gross: 0, fees: 0, taxable: 0, tax: 0, count: 0 };
    entry.gross += p.amount;
    entry.fees += p.fee;
    entry.taxable += p.exempt ? 0 : Math.max(0, p.amount - p.fee);
    entry.tax += calculatePaymentTax(p, jurisdictions);
    entry.count += 1;
    byJurisdiction.set(key, entry);
  }

  const breakdown = Array.from(byJurisdiction.values())
    .map((e) => ({
      ...e,
      gross: round2(e.gross),
      fees: round2(e.fees),
      taxable: round2(e.taxable),
      tax: round2(e.tax),
    }))
    .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));

  const tax = round2(breakdown.reduce((s, e) => s + e.tax, 0));
  const net = round2(gross - fees);
  return { year, gross, fees, net, count: rows.length, tax, afterTax: round2(net - tax), exemptGross, jurisdictions: breakdown };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildTaxReportCsv(
  payments: TaxablePayment[],
  year: number,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS
): string {
  const header = ["Invoice ID", "Title", "Paid At", "Asset", "Gross", "Fee", "Net"];
  const lines = filterByTaxYear(payments, year).map((p) =>
    [p.invoiceId, p.title, p.paidAt, p.asset, p.amount, p.fee, p.amount - p.fee].map(csvCell).join(",")
  );
  const s = summarizeTaxYear(payments, year, jurisdictions);
  lines.push(["TOTAL", "", "", "", s.gross, s.fees, s.net].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

/** Detailed report including jurisdiction, exemption and tax columns plus per-jurisdiction totals. */
export function buildDetailedTaxReportCsv(
  payments: TaxablePayment[],
  year: number,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS
): string {
  const header = [
    "Invoice ID",
    "Title",
    "Paid At",
    "Asset",
    "Gross",
    "Fee",
    "Net",
    "Jurisdiction",
    "Exempt",
    "Exemption Reason",
    "Tax",
  ];
  const rows = filterByTaxYear(payments, year);
  const lines = rows.map((p) => {
    const j = resolveJurisdiction(p.jurisdiction, jurisdictions);
    return [
      p.invoiceId,
      p.title,
      p.paidAt,
      p.asset,
      p.amount,
      p.fee,
      p.amount - p.fee,
      normalizeCode(j.code),
      p.exempt ? "yes" : "no",
      p.exempt ? p.exemptionReason ?? "" : "",
      calculatePaymentTax(p, jurisdictions),
    ]
      .map(csvCell)
      .join(",");
  });
  const s = summarizeTaxYear(payments, year, jurisdictions);
  lines.push(["TOTAL", "", "", "", s.gross, s.fees, s.net, "", "", "", s.tax].map(csvCell).join(","));
  for (const j of s.jurisdictions) {
    lines.push(
      ["JURISDICTION", j.name, "", "", j.gross, j.fees, round2(j.gross - j.fees), j.jurisdiction, "", "", j.tax]
        .map(csvCell)
        .join(",")
    );
  }
  return [header.join(","), ...lines].join("\n");
}
