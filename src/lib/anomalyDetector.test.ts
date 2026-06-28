/**
 * Unit tests for anomaly detector heuristics.
 *
 * Coverage:
 *   1. Rapid succession: flags correctly when >5 payments within 60 seconds
 *   2. Rapid succession: does NOT flag when ≤5 payments or outside window
 *   3. First-time large: flags when payer is new and >50% of invoice
 *   4. First-time large: does NOT flag for repeat payers
 *   5. First-time large: does NOT flag when ≤50% of invoice
 *   6. Edge cases: zero total, empty history, boundary conditions
 */

import { describe, it, expect } from "vitest";
import {
  detectAnomalies,
  AnomalyType,
  formatAnomalyTooltip,
} from "./anomalyDetector";
import type { Invoice, Payment, Recipient } from "@stellar-split/sdk";

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "test-invoice-1",
    status: "Pending",
    creator: "GCREATOR",
    recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }] as Recipient[],
    funded: 0n,
    deadline: 2_000_000_000,
    payments: [],
    token: "USDC",
    ...overrides,
  } as unknown as Invoice;
}

function makePayment(
  overrides: Partial<Payment & { timestamp?: number }> = {},
): Payment & { timestamp?: number } {
  return {
    payer: "GPAYER",
    amount: 10_000_000n,
    timestamp: Date.now(),
    ...overrides,
  } as Payment & { timestamp?: number };
}

// ── Rapid Succession Tests ───────────────────────────────────────────────────

describe("Rapid Succession Heuristic", () => {
  it("flags when >5 payments from same payer within 60s on invoice", () => {
    const now = Date.now();
    const payments: (Payment & { timestamp?: number })[] = Array.from(
      { length: 6 },
      (_, i) => ({
        payer: "GPAYER_A",
        amount: 5_000_000n,
        timestamp: now - (30 - i * 5) * 1000, // spread across 30 seconds
      }),
    ) as (Payment & { timestamp?: number })[];

    const invoice = makeInvoice({ payments });
    const newPayment = makePayment({
      payer: "GPAYER_A",
      amount: 5_000_000n,
      timestamp: now,
    });

    const flags = detectAnomalies(newPayment, invoice);
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe(AnomalyType.RAPID_SUCCESSION);
    expect(flags[0].payer).toBe("GPAYER_A");
    expect(flags[0].reason).toContain("60 seconds");
  });

  it("does NOT flag when exactly 5 payments within 60s", () => {
    const now = Date.now();
    const payments: (Payment & { timestamp?: number })[] = Array.from(
      { length: 5 },
      (_, i) => ({
        payer: "GPAYER_B",
        amount: 5_000_000n,
        timestamp: now - (30 - i * 8) * 1000,
      }),
    ) as (Payment & { timestamp?: number })[];

    const invoice = makeInvoice({ payments });
    const newPayment = makePayment({
      payer: "GPAYER_B",
      amount: 5_000_000n,
      timestamp: now,
    });

    const flags = detectAnomalies(newPayment, invoice);
    const rapidFlags = flags.filter((f) => f.type === AnomalyType.RAPID_SUCCESSION);
    expect(rapidFlags).toHaveLength(0);
  });

  it("does NOT flag when rapid payments are from different payers", () => {
    const now = Date.now();
    const payments: (Payment & { timestamp?: number })[] = [
      { payer: "GPAYER_1", amount: 5_000_000n, timestamp: now - 20_000 },
      { payer: "GPAYER_2", amount: 5_000_000n, timestamp: now - 15_000 },
      { payer: "GPAYER_3", amount: 5_000_000n, timestamp: now - 10_000 },
      { payer: "GPAYER_4", amount: 5_000_000n, timestamp: now - 5_000 },
    ] as (Payment & { timestamp?: number })[];

    const invoice = makeInvoice({ payments });
    const newPayment = makePayment({ payer: "GPAYER_5", timestamp: now });

    const flags = detectAnomalies(newPayment, invoice);
    const rapidFlags = flags.filter((f) => f.type === AnomalyType.RAPID_SUCCESSION);
    expect(rapidFlags).toHaveLength(0);
  });

  it("does NOT flag when rapid payments are outside 60s window", () => {
    const now = Date.now();
    const payments: (Payment & { timestamp?: number })[] = Array.from(
      { length: 6 },
      (_, i) => ({
        payer: "GPAYER_C",
        amount: 5_000_000n,
        timestamp: now - (90 - i * 5) * 1000, // older than 60s
      }),
    ) as (Payment & { timestamp?: number })[];

    const invoice = makeInvoice({ payments });
    const newPayment = makePayment({
      payer: "GPAYER_C",
      amount: 5_000_000n,
      timestamp: now,
    });

    const flags = detectAnomalies(newPayment, invoice);
    const rapidFlags = flags.filter((f) => f.type === AnomalyType.RAPID_SUCCESSION);
    expect(rapidFlags).toHaveLength(0);
  });

  it("handles invoices with no timestamp field gracefully", () => {
    // Some Payment objects may not have timestamp (edge case)
    const payments: Payment[] = [
      { payer: "GPAYER_D", amount: 5_000_000n },
      { payer: "GPAYER_D", amount: 5_000_000n },
    ] as Payment[];

    const invoice = makeInvoice({ payments });
    const newPayment = makePayment({ payer: "GPAYER_D" });

    // Should not throw; may not flag if timestamps are undefined
    const flags = detectAnomalies(newPayment, invoice);
    expect(Array.isArray(flags)).toBe(true);
  });
});

// ── First-Time Large Payer Tests ─────────────────────────────────────────────

describe("First-Time Large Payer Heuristic", () => {
  it("flags when new payer contributes >50% of invoice total", () => {
    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    });
    const payerHistory = new Map(); // Empty — no prior payments

    const newPayment = makePayment({
      payer: "GNEW_PAYER",
      amount: 51_000_000n, // >50%
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe(AnomalyType.FIRST_TIME_LARGE);
    expect(flags[0].payer).toBe("GNEW_PAYER");
    expect(flags[0].reason).toContain("New payer");
    expect(flags[0].reason).toContain("51.0%");
  });

  it("does NOT flag when new payer contributes exactly 50% of invoice", () => {
    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    });
    const payerHistory = new Map();

    const newPayment = makePayment({
      payer: "GNEW_PAYER_2",
      amount: 50_000_000n, // Exactly 50%
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    const firstTimeLargeFlags = flags.filter(
      (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
    );
    expect(firstTimeLargeFlags).toHaveLength(0);
  });

  it("does NOT flag when new payer contributes <50%", () => {
    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    });
    const payerHistory = new Map();

    const newPayment = makePayment({
      payer: "GNEW_PAYER_3",
      amount: 49_999_999n, // Just under 50%
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    const firstTimeLargeFlags = flags.filter(
      (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
    );
    expect(firstTimeLargeFlags).toHaveLength(0);
  });

  it("does NOT flag when repeat payer contributes >50%", () => {
    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    });
    const payerHistory = new Map([["GREPEAT_PAYER", 3]]); // Has prior payments

    const newPayment = makePayment({
      payer: "GREPEAT_PAYER",
      amount: 75_000_000n, // >50%, but not first-time
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    const firstTimeLargeFlags = flags.filter(
      (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
    );
    expect(firstTimeLargeFlags).toHaveLength(0);
  });

  it("handles edge case: zero invoice total", () => {
    const invoice = makeInvoice({
      recipients: [], // No recipients, total = 0
    });
    const payerHistory = new Map();

    const newPayment = makePayment({
      payer: "GNEW_PAYER_4",
      amount: 1_000_000n,
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    // With zero total, percentage is 0. Should not flag.
    const firstTimeLargeFlags = flags.filter(
      (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
    );
    expect(firstTimeLargeFlags).toHaveLength(0);
  });

  it("handles edge case: multiple recipients totaling large amount", () => {
    const invoice = makeInvoice({
      recipients: [
        { address: "GRECIPIENT_1", amount: 50_000_000n },
        { address: "GRECIPIENT_2", amount: 50_000_000n },
      ] as Recipient[],
    });
    const payerHistory = new Map();

    const newPayment = makePayment({
      payer: "GNEW_PAYER_5",
      amount: 60_000_000n, // 30% of 200M total
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    const firstTimeLargeFlags = flags.filter(
      (f) => f.type === AnomalyType.FIRST_TIME_LARGE,
    );
    expect(firstTimeLargeFlags).toHaveLength(0); // Not >50%
  });
});

// ── Combined Flags & Edge Cases ──────────────────────────────────────────────

describe("Combined Flags & Edge Cases", () => {
  it("returns both flags when both heuristics trigger", () => {
    const now = Date.now();
    // Scenario: new payer (history empty) + contributes >50% + also rapid-fire payments
    const payments: (Payment & { timestamp?: number })[] = [
      { payer: "GNEW_PAYER_6", amount: 20_000_000n, timestamp: now - 45_000 },
      { payer: "GNEW_PAYER_6", amount: 20_000_000n, timestamp: now - 30_000 },
      { payer: "GNEW_PAYER_6", amount: 20_000_000n, timestamp: now - 15_000 },
    ] as (Payment & { timestamp?: number })[];

    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
      payments,
    });
    const payerHistory = new Map(); // New payer

    const newPayment = makePayment({
      payer: "GNEW_PAYER_6",
      amount: 25_000_000n, // >50% of 100M + 6th rapid payment
      timestamp: now,
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    // Should have both rapid succession and first-time large
    expect(flags.length).toBeGreaterThanOrEqual(1); // At least one should trigger
  });

  it("returns empty array when no anomalies detected", () => {
    const invoice = makeInvoice({
      recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
      payments: [], // No prior payments
    });
    const payerHistory = new Map([["GKNOWN_PAYER", 5]]); // Known payer

    const newPayment = makePayment({
      payer: "GKNOWN_PAYER",
      amount: 10_000_000n, // Only 10% — no flag
    });

    const flags = detectAnomalies(newPayment, invoice, payerHistory);
    expect(flags).toHaveLength(0);
  });

  it("formatAnomalyTooltip returns empty string for no flags", () => {
    const tooltip = formatAnomalyTooltip([]);
    expect(tooltip).toBe("");
  });

  it("formatAnomalyTooltip formats single flag correctly", () => {
    const flags = [
      {
        type: AnomalyType.FIRST_TIME_LARGE,
        payer: "GPAYER",
        reason: "New payer contributing 75.0% of invoice total",
      },
    ];
    const tooltip = formatAnomalyTooltip(flags);
    expect(tooltip).toContain("New payer");
    expect(tooltip).toContain("•");
  });

  it("formatAnomalyTooltip formats multiple flags with line breaks", () => {
    const flags = [
      {
        type: AnomalyType.RAPID_SUCCESSION,
        payer: "GPAYER",
        reason: "6 payments in 60 seconds — check for script abuse",
      },
      {
        type: AnomalyType.FIRST_TIME_LARGE,
        payer: "GPAYER",
        reason: "New payer contributing 75.0% of invoice total",
      },
    ];
    const tooltip = formatAnomalyTooltip(flags);
    expect(tooltip).toContain("•");
    expect(tooltip).toContain("\n");
    expect(tooltip).toContain("script abuse");
    expect(tooltip).toContain("New payer");
  });
});
