import { describe, it, expect } from "vitest";
import { buildTaxReportCsv, summarizeTaxYear } from "./creatorTaxReport";

const payments = [
  { invoiceId: "1", title: "Dinner, split", paidAt: "2025-03-01T00:00:00Z", amount: 100, fee: 1, asset: "XLM" },
  { invoiceId: "2", title: "Rent", paidAt: "2025-12-31T23:00:00Z", amount: 500, fee: 5, asset: "USDC" },
  { invoiceId: "3", title: "Old", paidAt: "2024-06-01T00:00:00Z", amount: 999, fee: 9, asset: "XLM" },
];

describe("creatorTaxReport", () => {
  it("summarizes only the requested year", () => {
    expect(summarizeTaxYear(payments, 2025)).toEqual({ year: 2025, gross: 600, fees: 6, net: 594, count: 2 });
  });

  it("builds a CSV with escaped cells and a totals row", () => {
    const lines = buildTaxReportCsv(payments, 2025).split("\n");
    expect(lines[0]).toBe("Invoice ID,Title,Paid At,Asset,Gross,Fee,Net");
    expect(lines[1]).toBe('1,"Dinner, split",2025-03-01T00:00:00Z,XLM,100,1,99');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("TOTAL,,,,600,6,594");
  });
});
