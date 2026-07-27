import { describe, it, expect } from "vitest";
import {
  calculateFraudRiskScore,
  formatRiskScore,
  type FraudRiskScore,
} from "./fraudRiskScorer";
import { AnomalyType, type AnomalyFlag } from "./anomalyDetector";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoice: Invoice = {
  id: "test-invoice",
  creator: "GTEST",
  recipients: [
    { address: "GRECIPIENT1", amount: 500_000n, email: "" },
    { address: "GRECIPIENT2", amount: 500_000n, email: "" },
  ],
  payments: [],
  status: "pending",
  dueDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  description: "",
  custom: {},
  metadata: {},
} as unknown as Invoice;

describe("fraudRiskScorer", () => {
  it("should return low risk score for clean invoice", () => {
    const score = calculateFraudRiskScore(mockInvoice, []);
    expect(score.tier).toBe("low");
    expect(score.score).toBeLessThan(30);
  });

  it("should detect rapid succession anomaly", () => {
    const flags: AnomalyFlag[] = [
      {
        type: AnomalyType.RAPID_SUCCESSION,
        payer: "GPAYER1",
        reason: "5 payments in 60 seconds",
      },
    ];

    const score = calculateFraudRiskScore(mockInvoice, flags);
    expect(score.score).toBeGreaterThan(0);
    expect(score.signals.some((s) => s.signal === "rapid_succession")).toBe(
      true,
    );
  });

  it("should detect first-time large payer anomaly", () => {
    const flags: AnomalyFlag[] = [
      {
        type: AnomalyType.FIRST_TIME_LARGE,
        payer: "GPAYER1",
        reason: "New payer contributing 60% of invoice total",
      },
    ];

    const score = calculateFraudRiskScore(mockInvoice, flags);
    expect(score.score).toBeGreaterThan(0);
    expect(score.signals.some((s) => s.signal === "first_time_large")).toBe(
      true,
    );
  });

  it("should return high risk tier for score > 70", () => {
    const flags: AnomalyFlag[] = [
      {
        type: AnomalyType.RAPID_SUCCESSION,
        payer: "GPAYER1",
        reason: "6 payments in 60 seconds",
      },
      {
        type: AnomalyType.FIRST_TIME_LARGE,
        payer: "GPAYER2",
        reason: "New payer contributing 70% of invoice total",
      },
    ];

    const score = calculateFraudRiskScore(mockInvoice, flags);
    expect(score.tier).toBe("high");
    expect(score.score).toBeGreaterThanOrEqual(70);
  });

  it("should format risk score correctly", () => {
    const score: FraudRiskScore = {
      score: 45,
      tier: "medium",
      signals: [],
      timestamp: Date.now(),
    };

    const formatted = formatRiskScore(score);
    expect(formatted.scoreDisplay).toBe("45/100");
    expect(formatted.tierLabel).toBe("Medium Risk");
    expect(formatted.tierColor).toContain("amber");
    expect(formatted.isHighRisk).toBe(false);
  });

  it("should identify high-risk tier correctly", () => {
    const score: FraudRiskScore = {
      score: 80,
      tier: "high",
      signals: [],
      timestamp: Date.now(),
    };

    const formatted = formatRiskScore(score);
    expect(formatted.isHighRisk).toBe(true);
    expect(formatted.tierColor).toContain("red");
  });
});
