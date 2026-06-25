/**
 * Unit tests for bulkImporter.validateRows
 *
 * Coverage:
 *  - Address format validation (Stellar G-key regex)
 *  - Amount validation (positive, finite)
 *  - Duplicate (recipient_address + amount) pair detection
 *  - Combined multi-error collection per row
 *  - Return shape: 1-based `row` numbers, correct `errors` arrays
 *  - Optional-field validation: deadline_days, token
 */

import { validateRows } from "@/lib/bulkImporter";
import type { RecipientRow, ValidationResult } from "@/lib/bulkImporter";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal valid Stellar public key (G + 55 uppercase base32 chars). */
const VALID_ADDRESS = "GABC" + "A".repeat(52); // 56 chars total

function makeRow(overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    recipient_address: VALID_ADDRESS,
    amount: "100",
    ...overrides,
  };
}

function errorsFor(results: ValidationResult[], rowIndex: number): string[] {
  return results[rowIndex]?.errors ?? [];
}

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

describe("validateRows — address validation", () => {
  it("accepts a valid 56-char G-prefix base32 address", () => {
    const results = validateRows([makeRow()]);
    expect(errorsFor(results, 0)).toHaveLength(0);
  });

  it("rejects an address that does not start with G", () => {
    const results = validateRows([makeRow({ recipient_address: "AABC" + "A".repeat(52) })]);
    expect(errorsFor(results, 0)).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
  });

  it("rejects an address that is too short", () => {
    const results = validateRows([makeRow({ recipient_address: "GABC" })]);
    expect(errorsFor(results, 0)).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
  });

  it("rejects an address that is too long", () => {
    const results = validateRows([makeRow({ recipient_address: "G" + "A".repeat(56) })]);
    expect(errorsFor(results, 0)).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
  });

  it("rejects an empty address", () => {
    const results = validateRows([makeRow({ recipient_address: "" })]);
    expect(errorsFor(results, 0)).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
  });

  it("rejects an address containing lowercase letters", () => {
    // Stellar base32 uses uppercase only
    const results = validateRows([makeRow({ recipient_address: "G" + "a".repeat(55) })]);
    expect(errorsFor(results, 0)).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
  });
});

// ---------------------------------------------------------------------------
// Amount validation
// ---------------------------------------------------------------------------

describe("validateRows — amount validation", () => {
  it("accepts a positive integer amount", () => {
    const results = validateRows([makeRow({ amount: "50" })]);
    expect(errorsFor(results, 0)).toHaveLength(0);
  });

  it("accepts a positive decimal amount", () => {
    const results = validateRows([makeRow({ amount: "0.01" })]);
    expect(errorsFor(results, 0)).toHaveLength(0);
  });

  it("rejects zero", () => {
    const results = validateRows([makeRow({ amount: "0" })]);
    expect(errorsFor(results, 0)).toContain("Amount must be a positive number");
  });

  it("rejects a negative number", () => {
    const results = validateRows([makeRow({ amount: "-5" })]);
    expect(errorsFor(results, 0)).toContain("Amount must be a positive number");
  });

  it("rejects a non-numeric string", () => {
    const results = validateRows([makeRow({ amount: "abc" })]);
    expect(errorsFor(results, 0)).toContain("Amount must be a positive number");
  });

  it("rejects an empty string", () => {
    const results = validateRows([makeRow({ amount: "" })]);
    expect(errorsFor(results, 0)).toContain("Amount must be a positive number");
  });

  it("rejects NaN-producing input", () => {
    const results = validateRows([makeRow({ amount: "NaN" })]);
    expect(errorsFor(results, 0)).toContain("Amount must be a positive number");
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

describe("validateRows — duplicate detection", () => {
  const ADDR_A = "G" + "A".repeat(55);
  const ADDR_B = "G" + "B".repeat(55);

  it("flags both rows when recipient_address + amount is duplicated", () => {
    const rows: RecipientRow[] = [
      { recipient_address: ADDR_A, amount: "100" },
      { recipient_address: ADDR_A, amount: "100" },
    ];
    const results = validateRows(rows);
    expect(errorsFor(results, 0)).toContain(
      "Duplicate recipient + amount pair within this import"
    );
    expect(errorsFor(results, 1)).toContain(
      "Duplicate recipient + amount pair within this import"
    );
  });

  it("flags all three rows when the same pair appears three times", () => {
    const rows: RecipientRow[] = [
      { recipient_address: ADDR_A, amount: "50" },
      { recipient_address: ADDR_A, amount: "50" },
      { recipient_address: ADDR_A, amount: "50" },
    ];
    const results = validateRows(rows);
    [0, 1, 2].forEach((i) =>
      expect(errorsFor(results, i)).toContain(
        "Duplicate recipient + amount pair within this import"
      )
    );
  });

  it("does NOT flag same address with different amounts", () => {
    const rows: RecipientRow[] = [
      { recipient_address: ADDR_A, amount: "100" },
      { recipient_address: ADDR_A, amount: "200" },
    ];
    const results = validateRows(rows);
    expect(errorsFor(results, 0)).not.toContain(
      "Duplicate recipient + amount pair within this import"
    );
    expect(errorsFor(results, 1)).not.toContain(
      "Duplicate recipient + amount pair within this import"
    );
  });

  it("does NOT flag same amount with different addresses", () => {
    const rows: RecipientRow[] = [
      { recipient_address: ADDR_A, amount: "100" },
      { recipient_address: ADDR_B, amount: "100" },
    ];
    const results = validateRows(rows);
    expect(errorsFor(results, 0)).not.toContain(
      "Duplicate recipient + amount pair within this import"
    );
    expect(errorsFor(results, 1)).not.toContain(
      "Duplicate recipient + amount pair within this import"
    );
  });

  it("only flags the duplicate pair, leaving unique rows clean", () => {
    const rows: RecipientRow[] = [
      { recipient_address: ADDR_A, amount: "100" }, // unique — row 0
      { recipient_address: ADDR_B, amount: "50" },  // unique — row 1
      { recipient_address: ADDR_A, amount: "100" }, // dup of row 0 — row 2
    ];
    const results = validateRows(rows);
    expect(errorsFor(results, 1)).toHaveLength(0); // ADDR_B is clean
    expect(errorsFor(results, 0)).toContain(
      "Duplicate recipient + amount pair within this import"
    );
    expect(errorsFor(results, 2)).toContain(
      "Duplicate recipient + amount pair within this import"
    );
  });
});

// ---------------------------------------------------------------------------
// Combined multi-error collection
// ---------------------------------------------------------------------------

describe("validateRows — combined errors per row", () => {
  it("collects both address and amount errors on the same row", () => {
    const results = validateRows([makeRow({ recipient_address: "bad", amount: "-1" })]);
    const errors = errorsFor(results, 0);
    expect(errors).toContain(
      "Invalid Stellar address (must start with G and be 56 characters)"
    );
    expect(errors).toContain("Amount must be a positive number");
    expect(errors).toHaveLength(2);
  });

  it("returns empty errors array for an entirely valid row", () => {
    const results = validateRows([makeRow()]);
    expect(errorsFor(results, 0)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe("validateRows — return shape", () => {
  it("returns one ValidationResult per input row", () => {
    const rows = [makeRow(), makeRow({ amount: "0" }), makeRow()];
    const results = validateRows(rows);
    expect(results).toHaveLength(3);
  });

  it("uses 1-based row numbers", () => {
    const rows = [makeRow(), makeRow(), makeRow()];
    const results = validateRows(rows);
    expect(results[0].row).toBe(1);
    expect(results[1].row).toBe(2);
    expect(results[2].row).toBe(3);
  });

  it("returns an empty array when given no rows", () => {
    expect(validateRows([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Optional-field validation
// ---------------------------------------------------------------------------

describe("validateRows — optional field validation", () => {
  it("flags deadline_days of 0", () => {
    const results = validateRows([makeRow({ deadline_days: "0" })]);
    expect(errorsFor(results, 0)).toContain(
      "Deadline days must be a positive number"
    );
  });

  it("flags negative deadline_days", () => {
    const results = validateRows([makeRow({ deadline_days: "-3" })]);
    expect(errorsFor(results, 0)).toContain(
      "Deadline days must be a positive number"
    );
  });

  it("accepts positive deadline_days", () => {
    const results = validateRows([makeRow({ deadline_days: "30" })]);
    expect(errorsFor(results, 0)).not.toContain(
      "Deadline days must be a positive number"
    );
  });

  it("does not flag missing deadline_days (undefined)", () => {
    const results = validateRows([makeRow()]);
    expect(errorsFor(results, 0)).not.toContain(
      "Deadline days must be a positive number"
    );
  });

  it("flags an empty token string", () => {
    const results = validateRows([makeRow({ token: "" })]);
    expect(errorsFor(results, 0)).toContain("Token must not be empty");
  });

  it("accepts a non-empty token", () => {
    const results = validateRows([makeRow({ token: "USDC" })]);
    expect(errorsFor(results, 0)).not.toContain("Token must not be empty");
  });

  it("does not flag missing token (undefined)", () => {
    const results = validateRows([makeRow()]);
    expect(errorsFor(results, 0)).not.toContain("Token must not be empty");
  });
});
