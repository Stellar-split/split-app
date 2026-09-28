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
