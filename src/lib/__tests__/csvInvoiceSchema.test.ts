import { describe, it, expect } from "vitest";
import {
  parseRecipients,
  validateInvoiceFormFields,
  parseCSVLine,
  parseCSVRow,
  EXPECTED_COLUMNS,
} from "../csvInvoiceSchema";

describe("parseRecipients", () => {
  it("returns an empty array for an empty string", () => {
    expect(parseRecipients("")).toEqual([]);
  });

  it("parses a single address:percent pair", () => {
    expect(parseRecipients("GADDR1:50")).toEqual([
      { address: "GADDR1", amount: "0", percent: "50" },
    ]);
  });

  it("parses multiple pipe-delimited recipients", () => {
    expect(parseRecipients("GADDR1:50|GADDR2:50")).toEqual([
      { address: "GADDR1", amount: "0", percent: "50" },
      { address: "GADDR2", amount: "0", percent: "50" },
    ]);
  });

  it("trims whitespace around addresses and percentages", () => {
    expect(parseRecipients(" GADDR1 : 50 | GADDR2 : 50 ")).toEqual([
      { address: "GADDR1", amount: "0", percent: "50" },
      { address: "GADDR2", amount: "0", percent: "50" },
    ]);
  });

  it("defaults percent to '0' when missing", () => {
    expect(parseRecipients("GADDR1")).toEqual([
      { address: "GADDR1", amount: "0", percent: "0" },
    ]);
  });

  it("filters out entries with no address", () => {
    expect(parseRecipients("|GADDR1:50|:30")).toEqual([
      { address: "GADDR1", amount: "0", percent: "50" },
    ]);
  });
});

describe("validateInvoiceFormFields", () => {
  it("rejects null input", () => {
    expect(validateInvoiceFormFields(null)).toEqual({
      valid: false,
      error: "Invalid data format",
    });
  });

  it("rejects non-object input", () => {
    expect(validateInvoiceFormFields("not an object")).toEqual({
      valid: false,
      error: "Invalid data format",
    });
  });

  it("accepts an empty object and returns empty parsed data", () => {
    const result = validateInvoiceFormFields({});
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({});
  });

  it("coerces a numeric amount field to a string", () => {
    const result = validateInvoiceFormFields({ amount: 100 });
    expect(result.valid).toBe(true);
    expect(result.data?.amount).toBe("100");
  });

  it("passes through valid string fields", () => {
    const result = validateInvoiceFormFields({
      title: "Invoice #1",
      description: "Services rendered",
      recipients: "GADDR1:100",
      deadline: "2026-12-31",
      token: "USDC",
    });
    expect(result).toEqual({
      valid: true,
      data: {
        title: "Invoice #1",
        description: "Services rendered",
        recipients: "GADDR1:100",
        deadline: "2026-12-31",
        token: "USDC",
      },
    });
  });

  it("ignores fields with the wrong type", () => {
    const result = validateInvoiceFormFields({ title: 123, token: ["USDC"] });
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({});
  });
});

describe("parseCSVLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    expect(parseCSVLine('a,"he said ""hi""",c')).toEqual(["a", 'he said "hi"', "c"]);
  });

  it("trims surrounding whitespace from each field", () => {
    expect(parseCSVLine(" a , b , c ")).toEqual(["a", "b", "c"]);
  });
});

describe("parseCSVRow", () => {
  it("returns null when there are fewer than 2 lines", () => {
    expect(parseCSVRow("title,amount")).toBeNull();
  });

  it("returns null when header and value counts mismatch", () => {
    expect(parseCSVRow("title,amount\nOnly One Value")).toBeNull();
  });

  it("maps header names to row values", () => {
    const result = parseCSVRow("title,amount\nInvoice 1,100");
    expect(result).toEqual({
      columns: ["title", "amount"],
      data: { title: "Invoice 1", amount: "100" },
    });
  });

  it("only uses the first data row when multiple rows are present", () => {
    const result = parseCSVRow("title,amount\nInvoice 1,100\nInvoice 2,200");
    expect(result?.data).toEqual({ title: "Invoice 1", amount: "100" });
  });
});

describe("EXPECTED_COLUMNS", () => {
  it("includes all documented invoice form fields", () => {
    expect(EXPECTED_COLUMNS).toEqual([
      "title",
      "description",
      "amount",
      "recipients",
      "deadline",
      "token",
    ]);
  });
});
