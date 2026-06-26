/**
 * Unit tests for invoiceArchiveExport.
 *
 * Covers:
 *   1. buildInvoiceArchive includes correct schemaVersion
 *   2. generateArchiveFilename produces correct format
 *   3. buildInvoiceArchive works with empty audit log and empty payments
 *   4. BigInt amounts are properly serialized as formatted strings
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
}));

import {
  buildInvoiceArchive,
  generateArchiveFilename,
  ARCHIVE_SCHEMA_VERSION,
} from "@/lib/invoiceArchiveExport";

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-42",
    creator: "GCREATOR",
    status: "Pending",
    deadline: 1_700_000_000,
    funded: 50_000_000n,
    recipients: [
      { address: "GRECIPIENT1", amount: 70_000_000n },
      { address: "GRECIPIENT2", amount: 30_000_000n },
    ],
    ...overrides,
  };
}

const sampleAuditLog = [
  { action: "created", actor: "GCREATOR", timestamp: 1_700_000_000 },
  { action: "paid", actor: "GPAYER1", timestamp: 1_700_001_000 },
];

const samplePayments = [
  { payer: "GPAYER1", amount: 30_000_000n },
  { payer: "GPAYER2", amount: 20_000_000n },
];

// ── schemaVersion ───────────────────────────────────────────────────────────

describe("buildInvoiceArchive", () => {
  it("includes schemaVersion equal to ARCHIVE_SCHEMA_VERSION", () => {
    const archive = buildInvoiceArchive(
      makeInvoice(),
      sampleAuditLog,
      samplePayments,
    );
    expect(archive.schemaVersion).toBe(ARCHIVE_SCHEMA_VERSION);
  });

  it("includes an ISO 8601 exportedAt timestamp", () => {
    const archive = buildInvoiceArchive(
      makeInvoice(),
      sampleAuditLog,
      samplePayments,
    );
    // Should be a valid ISO date string
    expect(() => new Date(archive.exportedAt).toISOString()).not.toThrow();
    expect(archive.exportedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("works with empty audit log and empty payments", () => {
    const archive = buildInvoiceArchive(makeInvoice(), [], []);
    expect(archive.auditLog).toEqual([]);
    expect(archive.payments).toEqual([]);
    expect(archive.schemaVersion).toBe(ARCHIVE_SCHEMA_VERSION);
    // Invoice data should still be present
    expect(archive.invoice.id).toBe("inv-42");
  });

  it("serializes BigInt amounts as formatted strings", () => {
    const archive = buildInvoiceArchive(
      makeInvoice(),
      sampleAuditLog,
      samplePayments,
    );
    // funded: 50_000_000n → "5.00"
    expect(archive.invoice.funded).toBe("5.00");
    // totalAmount: 70_000_000n + 30_000_000n = 100_000_000n → "10.00"
    expect(archive.invoice.totalAmount).toBe("10.00");
    // recipient amounts
    expect(archive.invoice.recipients[0].amount).toBe("7.00");
    expect(archive.invoice.recipients[1].amount).toBe("3.00");
    // payment amounts
    expect(archive.payments[0].amount).toBe("3.00");
    expect(archive.payments[1].amount).toBe("2.00");
  });

  it("maps audit log entries correctly", () => {
    const archive = buildInvoiceArchive(
      makeInvoice(),
      sampleAuditLog,
      samplePayments,
    );
    expect(archive.auditLog).toHaveLength(2);
    expect(archive.auditLog[0]).toEqual({
      action: "created",
      actor: "GCREATOR",
      timestamp: 1_700_000_000,
    });
  });

  it("maps payments correctly", () => {
    const archive = buildInvoiceArchive(
      makeInvoice(),
      sampleAuditLog,
      samplePayments,
    );
    expect(archive.payments).toHaveLength(2);
    expect(archive.payments[0].payer).toBe("GPAYER1");
  });
});

// ── generateArchiveFilename ─────────────────────────────────────────────────

describe("generateArchiveFilename", () => {
  it("starts with 'invoice-' and contains the invoice id", () => {
    const filename = generateArchiveFilename("inv-42");
    expect(filename.startsWith("invoice-inv-42")).toBe(true);
  });

  it("contains 'archive' in the filename", () => {
    const filename = generateArchiveFilename("inv-42");
    expect(filename).toContain("archive");
  });

  it("ends with .json", () => {
    const filename = generateArchiveFilename("inv-42");
    expect(filename.endsWith(".json")).toBe(true);
  });

  it("does not contain colons or dots (except .json extension)", () => {
    const filename = generateArchiveFilename("inv-42");
    const withoutExtension = filename.replace(/\.json$/, "");
    expect(withoutExtension).not.toContain(":");
    expect(withoutExtension).not.toContain(".");
  });
});
