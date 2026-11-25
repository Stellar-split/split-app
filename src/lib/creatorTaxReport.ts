export interface TaxablePayment {
  invoiceId: string;
  title: string;
  /** ISO date the payment settled. */
  paidAt: string;
  amount: number;
  fee: number;
  asset: string;
}

export interface TaxReportSummary {
  year: number;
  gross: number;
  fees: number;
  net: number;
  count: number;
}

export function filterByTaxYear(payments: TaxablePayment[], year: number): TaxablePayment[] {
  return payments.filter((p) => new Date(p.paidAt).getUTCFullYear() === year);
}

export function summarizeTaxYear(payments: TaxablePayment[], year: number): TaxReportSummary {
  const rows = filterByTaxYear(payments, year);
  const gross = rows.reduce((s, p) => s + p.amount, 0);
  const fees = rows.reduce((s, p) => s + p.fee, 0);
  return { year, gross, fees, net: gross - fees, count: rows.length };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildTaxReportCsv(payments: TaxablePayment[], year: number): string {
  const header = ["Invoice ID", "Title", "Paid At", "Asset", "Gross", "Fee", "Net"];
  const lines = filterByTaxYear(payments, year).map((p) =>
    [p.invoiceId, p.title, p.paidAt, p.asset, p.amount, p.fee, p.amount - p.fee].map(csvCell).join(",")
  );
  const s = summarizeTaxYear(payments, year);
  lines.push(["TOTAL", "", "", "", s.gross, s.fees, s.net].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

/** A tax jurisdiction with the rate applied to a creator's net income. */
export interface TaxJurisdiction {
  /** Stable identifier, e.g. `US-CA`. */
  code: string;
  /** Human readable name used in reports. */
  name: string;
  /** Tax rate as a fraction of the net amount (0.075 = 7.5%). */
  rate: number;
}

/** A tax year summary with jurisdiction tax applied. */
export interface JurisdictionTaxSummary extends TaxReportSummary {
  jurisdiction: string;
  jurisdictionName: string;
  taxableBase: number;
  taxOwed: number;
}

export const DEFAULT_JURISDICTIONS: TaxJurisdiction[] = [
  { code: "NONE", name: "No tax jurisdiction", rate: 0 },
  { code: "US", name: "United States", rate: 0.24 },
  { code: "EU", name: "European Union", rate: 0.2 },
  { code: "UK", name: "United Kingdom", rate: 0.2 },
  { code: "NG", name: "Nigeria", rate: 0.075 },
];

const roundAmount = (value: number): number => Math.round(value * 1e8) / 1e8;

/** Summarizes a tax year per asset, for assets taxed differently. */
export function summarizeTaxYearByAsset(
  payments: TaxablePayment[],
  year: number,
): Record<string, TaxReportSummary> {
  const result: Record<string, TaxReportSummary> = {};
  for (const p of filterByTaxYear(payments, year)) {
    const current = result[p.asset] ?? { year, gross: 0, fees: 0, net: 0, count: 0 };
    current.gross = roundAmount(current.gross + p.amount);
    current.fees = roundAmount(current.fees + p.fee);
    current.net = roundAmount(current.gross - current.fees);
    current.count += 1;
    result[p.asset] = current;
  }
  return result;
}

/** Applies a jurisdiction's rate to a tax year summary. */
export function calculateJurisdictionTax(
  summary: TaxReportSummary,
  jurisdiction: TaxJurisdiction,
): JurisdictionTaxSummary {
  return {
    ...summary,
    jurisdiction: jurisdiction.code,
    jurisdictionName: jurisdiction.name,
    taxableBase: summary.net,
    taxOwed: roundAmount(summary.net * jurisdiction.rate),
  };
}

/** Calculates tax for every jurisdiction (defaults to the built-in set). */
export function calculateTaxAcrossJurisdictions(
  payments: TaxablePayment[],
  year: number,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS,
): JurisdictionTaxSummary[] {
  const summary = summarizeTaxYear(payments, year);
  return jurisdictions.map((j) => calculateJurisdictionTax(summary, j));
}

/** Builds a CSV report with one row per jurisdiction for a tax year. */
export function buildJurisdictionTaxCsv(
  payments: TaxablePayment[],
  year: number,
  jurisdictions: TaxJurisdiction[] = DEFAULT_JURISDICTIONS,
): string {
  const header = ["Jurisdiction", "Name", "Year", "Gross", "Fees", "Net", "Taxable Base", "Tax Owed"];
  const lines = calculateTaxAcrossJurisdictions(payments, year, jurisdictions).map((s) =>
    [s.jurisdiction, s.jurisdictionName, s.year, s.gross, s.fees, s.net, s.taxableBase, s.taxOwed]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
