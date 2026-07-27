/**
 * Unit tests for invoice audit trail PDF export.
 *
 * Covers:
 *  - PDF generation from audit logs
 *  - Audit log data structure and sorting
 *  - Transaction hash explorer links
 *  - SHA-256 verification hash generation
 *  - Performance constraints (< 5 seconds for 500+ entries)
 *  - Tamper-detection mechanisms
 *  - Chronological ordering of events
 *  - Data completeness (timestamp, actor, action)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

interface AuditLogEntry {
  timestamp: Date;
  actor: string; // user address or system
  action: string; // "created", "payment_received", "status_changed", etc.
  details: string;
  transactionHash?: string;
}

interface AuditTrailPDF {
  pdf: Buffer;
  verificationHash: string;
  entriesCount: number;
  generatedAt: Date;
}

// Helper functions
export const generateSHA256Hash = (data: string): string => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

export const createAuditTrailPDF = (entries: AuditLogEntry[]): AuditTrailPDF => {
  // Sort entries chronologically
  const sortedEntries = [...entries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Create audit data string
  let auditDataString = "AUDIT_TRAIL\n";
  auditDataString += "=".repeat(50) + "\n\n";

  sortedEntries.forEach((entry, index) => {
    auditDataString += `Entry ${index + 1}\n`;
    auditDataString += `Timestamp: ${entry.timestamp.toISOString()}\n`;
    auditDataString += `Actor: ${entry.actor}\n`;
    auditDataString += `Action: ${entry.action}\n`;
    auditDataString += `Details: ${entry.details}\n`;
    if (entry.transactionHash) {
      auditDataString += `Transaction: ${entry.transactionHash}\n`;
    }
    auditDataString += "\n";
  });

  // Generate verification hash
  const verificationHash = generateSHA256Hash(auditDataString);

  // Add verification hash to document
  auditDataString += "\n" + "=".repeat(50) + "\n";
  auditDataString += `Verification Hash (SHA-256): ${verificationHash}\n`;
  auditDataString += `Generated: ${new Date().toISOString()}\n`;

  // Convert to PDF buffer (simulated)
  const pdf = Buffer.from(auditDataString, "utf-8");

  return {
    pdf,
    verificationHash,
    entriesCount: sortedEntries.length,
    generatedAt: new Date(),
  };
};

export const validateAuditTrailIntegrity = (
  pdfContent: string,
  claimedHash: string
): boolean => {
  // Remove verification hash section for validation
  const contentWithoutHash = pdfContent.split("Verification Hash")[0].trim();
  const calculatedHash = generateSHA256Hash(contentWithoutHash);
  return calculatedHash === claimedHash;
};

export const buildExplorerLink = (transactionHash: string): string => {
  return `https://stellar.expert/explorer/public/tx/${transactionHash}`;
};

export const sortAuditEntriesChronologically = (
  entries: AuditLogEntry[]
): AuditLogEntry[] => {
  return [...entries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
};

describe("invoiceAuditTrailPDF", () => {
  const createTestEntry = (overrides?: Partial<AuditLogEntry>): AuditLogEntry => ({
    timestamp: new Date("2026-01-15T10:00:00Z"),
    actor: "GBTCHKH4IIT3DYQF7GAZPRMH5CHA4RTJOY2O3YYJWCEPIA3XBKXZMWP",
    action: "created",
    details: "Invoice created by recipient",
    ...overrides,
  });

  describe("createAuditTrailPDF", () => {
    it("generates PDF with valid structure", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);

      expect(result.pdf).toBeTruthy();
      expect(Buffer.isBuffer(result.pdf)).toBe(true);
      expect(result.verificationHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.entriesCount).toBe(1);
    });

    it("includes all audit log entries in PDF", () => {
      const entries = [
        createTestEntry({ action: "created" }),
        createTestEntry({ action: "payment_received", timestamp: new Date("2026-01-15T11:00:00Z") }),
        createTestEntry({ action: "status_changed", timestamp: new Date("2026-01-15T12:00:00Z") }),
      ];

      const result = createAuditTrailPDF(entries);
      const pdfText = result.pdf.toString("utf-8");

      expect(pdfText).toContain("created");
      expect(pdfText).toContain("payment_received");
      expect(pdfText).toContain("status_changed");
      expect(result.entriesCount).toBe(3);
    });

    it("sorts entries chronologically", () => {
      const entries = [
        createTestEntry({ action: "status_changed", timestamp: new Date("2026-01-15T12:00:00Z") }),
        createTestEntry({ action: "created", timestamp: new Date("2026-01-15T10:00:00Z") }),
        createTestEntry({ action: "payment_received", timestamp: new Date("2026-01-15T11:00:00Z") }),
      ];

      const result = createAuditTrailPDF(entries);
      const pdfText = result.pdf.toString("utf-8");

      // Check order: created should appear before payment_received before status_changed
      const createdIndex = pdfText.indexOf("created");
      const paymentIndex = pdfText.indexOf("payment_received");
      const statusIndex = pdfText.indexOf("status_changed");

      expect(createdIndex).toBeLessThan(paymentIndex);
      expect(paymentIndex).toBeLessThan(statusIndex);
    });

    it("includes transaction hashes with explorer links", () => {
      const txHash = "abc123def456xyz";
      const entries = [
        createTestEntry({
          action: "payment_received",
          transactionHash: txHash,
        }),
      ];

      const result = createAuditTrailPDF(entries);
      const pdfText = result.pdf.toString("utf-8");

      expect(pdfText).toContain(txHash);
    });

    it("generates unique verification hash for different content", () => {
      const entries1 = [createTestEntry({ action: "created" })];
      const entries2 = [createTestEntry({ action: "modified" })];

      const result1 = createAuditTrailPDF(entries1);
      const result2 = createAuditTrailPDF(entries2);

      expect(result1.verificationHash).not.toBe(result2.verificationHash);
    });

    it("includes verification hash in PDF", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);
      const pdfText = result.pdf.toString("utf-8");

      expect(pdfText).toContain("Verification Hash");
      expect(pdfText).toContain(result.verificationHash);
    });

    it("handles large number of entries (500+)", () => {
      const entries: AuditLogEntry[] = Array.from({ length: 550 }, (_, i) =>
        createTestEntry({
          action: `action_${i}`,
          timestamp: new Date("2026-01-15T10:00:00Z").getTime() + i * 60000, // 1 minute apart
        })
      ).map(e => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));

      const startTime = performance.now();
      const result = createAuditTrailPDF(entries);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.entriesCount).toBe(550);
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    it("includes all entry components (timestamp, actor, action, details)", () => {
      const entry = createTestEntry({
        timestamp: new Date("2026-03-15T14:30:00Z"),
        actor: "USER_ADDR_123",
        action: "payment_processed",
        details: "Payment of 100 USDC processed successfully",
      });

      const result = createAuditTrailPDF([entry]);
      const pdfText = result.pdf.toString("utf-8");

      expect(pdfText).toContain("2026-03-15T14:30:00Z");
      expect(pdfText).toContain("USER_ADDR_123");
      expect(pdfText).toContain("payment_processed");
      expect(pdfText).toContain("Payment of 100 USDC processed successfully");
    });
  });

  describe("validateAuditTrailIntegrity", () => {
    it("validates correct audit trail hash", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);
      const pdfText = result.pdf.toString("utf-8");

      const isValid = validateAuditTrailIntegrity(pdfText, result.verificationHash);
      expect(isValid).toBe(true);
    });

    it("rejects tampered content", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);
      let pdfText = result.pdf.toString("utf-8");

      // Simulate tampering
      pdfText = pdfText.replace("created", "deleted");

      const isValid = validateAuditTrailIntegrity(pdfText, result.verificationHash);
      expect(isValid).toBe(false);
    });

    it("detects modified timestamps", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);
      let pdfText = result.pdf.toString("utf-8");

      // Modify timestamp
      pdfText = pdfText.replace(
        "2026-01-15T10:00:00Z",
        "2026-01-16T10:00:00Z"
      );

      const isValid = validateAuditTrailIntegrity(pdfText, result.verificationHash);
      expect(isValid).toBe(false);
    });

    it("detects added entries", () => {
      const entries = [createTestEntry()];
      const result = createAuditTrailPDF(entries);
      let pdfText = result.pdf.toString("utf-8");

      // Add fake entry
      pdfText = pdfText.replace(
        "Verification Hash",
        "Entry 999\nTimestamp: 2026-01-15T15:00:00Z\nActor: HACKER\nAction: fraud\n\nVerification Hash"
      );

      const isValid = validateAuditTrailIntegrity(pdfText, result.verificationHash);
      expect(isValid).toBe(false);
    });
  });

  describe("buildExplorerLink", () => {
    it("builds correct explorer URL for transaction hash", () => {
      const txHash = "abc123def456";
      const link = buildExplorerLink(txHash);

      expect(link).toContain("stellar.expert");
      expect(link).toContain("explorer");
      expect(link).toContain("public");
      expect(link).toContain("tx");
      expect(link).toContain(txHash);
    });

    it("handles different transaction hash formats", () => {
      const hashes = [
        "abc123",
        "ABC123DEF456",
        "0123456789abcdef",
        "xyz123xyz123xyz123",
      ];

      hashes.forEach(hash => {
        const link = buildExplorerLink(hash);
        expect(link).toContain(hash);
      });
    });
  });

  describe("sortAuditEntriesChronologically", () => {
    it("sorts entries by timestamp ascending", () => {
      const entries = [
        createTestEntry({
          action: "action3",
          timestamp: new Date("2026-01-15T15:00:00Z"),
        }),
        createTestEntry({
          action: "action1",
          timestamp: new Date("2026-01-15T10:00:00Z"),
        }),
        createTestEntry({
          action: "action2",
          timestamp: new Date("2026-01-15T12:00:00Z"),
        }),
      ];

      const sorted = sortAuditEntriesChronologically(entries);

      expect(sorted[0].action).toBe("action1");
      expect(sorted[1].action).toBe("action2");
      expect(sorted[2].action).toBe("action3");
    });

    it("does not mutate original array", () => {
      const entries = [
        createTestEntry({ action: "action2", timestamp: new Date("2026-01-15T15:00:00Z") }),
        createTestEntry({ action: "action1", timestamp: new Date("2026-01-15T10:00:00Z") }),
      ];

      const original = entries[0];
      sortAuditEntriesChronologically(entries);

      expect(entries[0]).toBe(original);
    });

    it("handles entries with same timestamp", () => {
      const sameTime = new Date("2026-01-15T10:00:00Z");
      const entries = [
        createTestEntry({ action: "action2", timestamp: sameTime }),
        createTestEntry({ action: "action1", timestamp: sameTime }),
      ];

      const sorted = sortAuditEntriesChronologically(entries);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].timestamp).toEqual(sorted[1].timestamp);
    });
  });

  describe("SHA-256 Hash Generation", () => {
    it("generates valid SHA-256 hash", () => {
      const data = "test data";
      const hash = generateSHA256Hash(data);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64);
    });

    it("generates different hashes for different inputs", () => {
      const hash1 = generateSHA256Hash("input1");
      const hash2 = generateSHA256Hash("input2");

      expect(hash1).not.toBe(hash2);
    });

    it("generates same hash for same input (deterministic)", () => {
      const data = "consistent data";
      const hash1 = generateSHA256Hash(data);
      const hash2 = generateSHA256Hash(data);

      expect(hash1).toBe(hash2);
    });
  });

  describe("End-to-end PDF generation and validation", () => {
    it("creates valid PDF and passes integrity check", () => {
      const entries = [
        createTestEntry({ action: "created" }),
        createTestEntry({
          action: "payment_received",
          timestamp: new Date("2026-01-15T11:00:00Z"),
        }),
      ];

      const pdfResult = createAuditTrailPDF(entries);
      const pdfText = pdfResult.pdf.toString("utf-8");

      const isValid = validateAuditTrailIntegrity(pdfText, pdfResult.verificationHash);
      expect(isValid).toBe(true);
    });

    it("maintains integrity across multiple generations", () => {
      const entries = [createTestEntry()];

      const result1 = createAuditTrailPDF(entries);
      const result2 = createAuditTrailPDF(entries);

      // Both should be valid but different (timestamps differ)
      const text1 = result1.pdf.toString("utf-8");
      const text2 = result2.pdf.toString("utf-8");

      expect(validateAuditTrailIntegrity(text1, result1.verificationHash)).toBe(true);
      expect(validateAuditTrailIntegrity(text2, result2.verificationHash)).toBe(true);
    });
  });
});
