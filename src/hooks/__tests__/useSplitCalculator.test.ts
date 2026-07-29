import { describe, expect, it } from "vitest";
import {
  calculateSplit,
  validateShares,
  defaultRecipientLine,
  type RecipientLine,
} from "../useSplitCalculator";

describe("validateShares", () => {
  it("passes for single recipient with 100%", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(true);
    expect(v.sharesSumTo100).toBe(true);
    expect(v.errorMessage).toBeNull();
  });

  it("passes for multiple recipients summing to 100%", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 60, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 30, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G3", sharePercent: 10, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    expect(validateShares(lines).isValid).toBe(true);
  });

  it("fails when shares do not sum to 100%", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 30, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(false);
    expect(v.sharesSumTo100).toBe(false);
    expect(v.sharesDelta).toBeCloseTo(20, 4);
    expect(v.errorMessage).toMatch(/sum to 100/);
  });

  it("fails for empty recipients", () => {
    const v = validateShares([]);
    expect(v.isValid).toBe(false);
    expect(v.hasRecipients).toBe(false);
    expect(v.errorMessage).toMatch(/At least one/);
  });

  it("fails when share percentage is negative", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: -5, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 105, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(false);
    expect(v.allSharesNonNegative).toBe(false);
    expect(v.errorMessage).toMatch(/non-negative/);
  });

  it("fails when tax rate exceeds 100%", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: 150, fixedFeeXLM: 0 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(false);
    expect(v.allTaxRatesValid).toBe(false);
  });

  it("fails when tax rate is negative", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: -10, fixedFeeXLM: 0 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(false);
    expect(v.allTaxRatesValid).toBe(false);
  });

  it("fails when fixed fee is negative", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: -5 },
    ];
    const v = validateShares(lines);
    expect(v.isValid).toBe(false);
    expect(v.allFeesNonNegative).toBe(false);
  });

  it("accepts 0% tax and 0 fee", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    expect(validateShares(lines).isValid).toBe(true);
  });

  it("accepts 100% tax rate", () => {
    const lines: RecipientLine[] = [
      { address: "G1", sharePercent: 100, taxRatePercent: 100, fixedFeeXLM: 0 },
    ];
    expect(validateShares(lines).isValid).toBe(true);
  });
});

describe("calculateSplit - single recipient 100%", () => {
  it("computes net amount with 0 tax and 0 fee", () => {
    const result = calculateSplit(
      100,
      [{ address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: 0 }],
      "USDC"
    );
    expect(result.derivedLines.length).toBe(1);
    expect(result.derivedLines[0].grossAmount).toBeCloseTo(100, 7);
    expect(result.derivedLines[0].effectiveTaxAmount).toBeCloseTo(0, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(100, 7);
    expect(result.totalGross).toBeCloseTo(100, 7);
    expect(result.totalNet).toBeCloseTo(100, 7);
    expect(result.validation.isValid).toBe(true);
  });

  it("deducts tax correctly", () => {
    const result = calculateSplit(
      100,
      [{ address: "G1", sharePercent: 100, taxRatePercent: 25, fixedFeeXLM: 0 }],
      "USDC"
    );
    expect(result.derivedLines[0].grossAmount).toBeCloseTo(100, 7);
    expect(result.derivedLines[0].effectiveTaxAmount).toBeCloseTo(25, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(75, 7);
    expect(result.totalTax).toBeCloseTo(25, 7);
    expect(result.totalNet).toBeCloseTo(75, 7);
  });

  it("deducts fixed fee correctly (after tax)", () => {
    const result = calculateSplit(
      100,
      [{ address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: 10 }],
      "USDC"
    );
    expect(result.derivedLines[0].effectiveTaxAmount).toBeCloseTo(0, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(90, 7);
    expect(result.totalFees).toBeCloseTo(10, 7);
    expect(result.totalNet).toBeCloseTo(90, 7);
  });

  it("applies tax first then fixed fee", () => {
    const result = calculateSplit(
      100,
      [{ address: "G1", sharePercent: 100, taxRatePercent: 20, fixedFeeXLM: 5 }],
      "USDC"
    );
    expect(result.derivedLines[0].grossAmount).toBeCloseTo(100, 7);
    expect(result.derivedLines[0].effectiveTaxAmount).toBeCloseTo(20, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(75, 7);
  });

  it("net amount floors at 0 when fee exceeds after-tax", () => {
    const result = calculateSplit(
      10,
      [{ address: "G1", sharePercent: 100, taxRatePercent: 50, fixedFeeXLM: 20 }],
      "XLM"
    );
    expect(result.derivedLines[0].netAmount).toBeCloseTo(0, 7);
    expect(result.totalNet).toBeCloseTo(0, 7);
  });
});

describe("calculateSplit - zero tax rate", () => {
  it("passes net == gross for all recipients", () => {
    const recipients: RecipientLine[] = [
      { address: "G1", sharePercent: 70, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 30, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const result = calculateSplit(200, recipients, "USDC");
    expect(result.derivedLines[0].grossAmount).toBeCloseTo(140, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(140, 7);
    expect(result.derivedLines[1].grossAmount).toBeCloseTo(60, 7);
    expect(result.derivedLines[1].netAmount).toBeCloseTo(60, 7);
    expect(result.totalTax).toBeCloseTo(0, 7);
    expect(result.totalNet).toBeCloseTo(result.totalGross, 7);
  });
});

describe("calculateSplit - recipient removed mid-session", () => {
  it("rebalances correctly when a recipient is dropped", () => {
    const threeRecipients: RecipientLine[] = [
      { address: "G1", sharePercent: 50, taxRatePercent: 10, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 25, taxRatePercent: 0, fixedFeeXLM: 1 },
      { address: "G3", sharePercent: 25, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const r1 = calculateSplit(1000, threeRecipients, "USDC");
    expect(r1.derivedLines.length).toBe(3);

    const twoRecipients = threeRecipients.slice(0, 2);
    twoRecipients[0].sharePercent = 66.6667;
    twoRecipients[1].sharePercent = 33.3333;

    const r2 = calculateSplit(1000, twoRecipients, "USDC");
    expect(r2.derivedLines.length).toBe(2);
    expect(r2.derivedLines[0].grossAmount + r2.derivedLines[1].grossAmount).toBeCloseTo(1000, 7);
    expect(r2.validation.isValid).toBe(true);
  });

  it("returns 0 totals for empty recipients without crashing", () => {
    const result = calculateSplit(1000, [], "USDC");
    expect(result.derivedLines).toEqual([]);
    expect(result.totalGross).toBeCloseTo(0, 7);
    expect(result.totalNet).toBeCloseTo(0, 7);
    expect(result.validation.isValid).toBe(false);
  });
});

describe("calculateSplit - total changed after tax applied", () => {
  const recipients: RecipientLine[] = [
    { address: "G1", sharePercent: 60, taxRatePercent: 20, fixedFeeXLM: 2 },
    { address: "G2", sharePercent: 40, taxRatePercent: 10, fixedFeeXLM: 0 },
  ];

  it("reacts to gross total increase", () => {
    const small = calculateSplit(100, recipients, "USDC");
    const big = calculateSplit(1000, recipients, "USDC");
    expect(big.totalGross).toBeCloseTo(1000, 7);
    expect(big.totalTax).toBeGreaterThan(small.totalTax);
    expect(big.totalNet).toBeGreaterThan(small.totalNet);
  });

  it("reacts to gross total decrease", () => {
    const big = calculateSplit(500, recipients, "USDC");
    const small = calculateSplit(50, recipients, "USDC");
    expect(small.totalNet).toBeLessThan(big.totalNet);
    expect(small.validation.isValid).toBe(true);
  });

  it("handles 0 total without NaN", () => {
    const result = calculateSplit(0, recipients, "USDC");
    expect(Number.isNaN(result.totalNet)).toBe(false);
    expect(result.totalNet).toBeCloseTo(0, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(0, 7);
  });
});

describe("7-decimal stroop precision", () => {
  it("rounds to 7 decimals (stroop precision)", () => {
    const result = calculateSplit(
      1,
      [{ address: "G1", sharePercent: 33.3333333, taxRatePercent: 0, fixedFeeXLM: 0 }],
      "XLM"
    );
    const netStr = result.derivedLines[0].netAmount.toFixed(7);
    expect(netStr).toBe(result.derivedLines[0].netAmount.toFixed(7));
    expect(netStr.split(".")[1]?.length ?? 0).toBeLessThanOrEqual(7);
  });

  it("handles fractions summing to 100% with 4-decimal precision", () => {
    const recipients: RecipientLine[] = [
      { address: "G1", sharePercent: 33.3333, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G2", sharePercent: 33.3333, taxRatePercent: 0, fixedFeeXLM: 0 },
      { address: "G3", sharePercent: 33.3334, taxRatePercent: 0, fixedFeeXLM: 0 },
    ];
    const v = validateShares(recipients);
    expect(v.sharesSumTo100).toBe(true);
    const result = calculateSplit(1_000_000, recipients, "USDC");
    expect(result.totalGross).toBeCloseTo(1_000_000, 7);
  });
});

describe("defaultRecipientLine", () => {
  it("creates zeroed line", () => {
    const l = defaultRecipientLine("GADDR");
    expect(l.address).toBe("GADDR");
    expect(l.sharePercent).toBe(0);
    expect(l.taxRatePercent).toBe(0);
    expect(l.fixedFeeXLM).toBe(0);
  });

  it("defaults address to empty string", () => {
    expect(defaultRecipientLine().address).toBe("");
  });
});

describe("mixed scenario with tax + fees + multiple recipients", () => {
  it("produces expected totals", () => {
    const recipients: RecipientLine[] = [
      { address: "G1", sharePercent: 50, taxRatePercent: 15, fixedFeeXLM: 1.5 },
      { address: "G2", sharePercent: 30, taxRatePercent: 10, fixedFeeXLM: 0 },
      { address: "G3", sharePercent: 20, taxRatePercent: 0, fixedFeeXLM: 5 },
    ];
    const result = calculateSplit(1000, recipients, "USDC");

    expect(result.derivedLines[0].grossAmount).toBeCloseTo(500, 7);
    expect(result.derivedLines[0].effectiveTaxAmount).toBeCloseTo(75, 7);
    expect(result.derivedLines[0].netAmount).toBeCloseTo(500 - 75 - 1.5, 7);

    expect(result.derivedLines[1].grossAmount).toBeCloseTo(300, 7);
    expect(result.derivedLines[1].effectiveTaxAmount).toBeCloseTo(30, 7);
    expect(result.derivedLines[1].netAmount).toBeCloseTo(270, 7);

    expect(result.derivedLines[2].grossAmount).toBeCloseTo(200, 7);
    expect(result.derivedLines[2].effectiveTaxAmount).toBeCloseTo(0, 7);
    expect(result.derivedLines[2].netAmount).toBeCloseTo(195, 7);

    expect(result.totalGross).toBeCloseTo(1000, 7);
    expect(result.totalTax).toBeCloseTo(105, 7);
    expect(result.totalFees).toBeCloseTo(6.5, 7);
    expect(result.totalNet).toBeCloseTo(1000 - 105 - 6.5, 7);
  });
});
