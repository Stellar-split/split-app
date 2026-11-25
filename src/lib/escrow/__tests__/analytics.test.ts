import { describe, expect, it } from "vitest";
import {
  computeEscrowAnalytics,
  filterEscrows,
  generateEscrowMarkdownReport,
} from "../analytics";
import type { EscrowContract } from "@/types/escrow";

function createMockEscrows(): EscrowContract[] {
  return [
    {
      id: "e1",
      depositor: "alice",
      beneficiary: "bob",
      recipients: [{ address: "bob", amount: 1000n }],
      token: "USDC",
      targetAmount: 1000n,
      fundedAmount: 1000n,
      status: "Released",
      releaseTriggerType: "AUTOMATIC",
      conditionLogic: "ALL",
      conditions: [
        { id: "c1", type: "TIME_LOCK", title: "Time", releaseTimestamp: 100, met: true },
      ],
      disputeHold: false,
      history: [],
      createdAt: 1000,
      updatedAt: 1060,
      releasedAt: 1060,
    },
    {
      id: "e2",
      depositor: "alice",
      beneficiary: "charlie",
      recipients: [{ address: "charlie", amount: 2000n }],
      token: "USDC",
      targetAmount: 2000n,
      fundedAmount: 2000n,
      status: "Disputed",
      releaseTriggerType: "AUTOMATIC",
      conditionLogic: "ALL",
      conditions: [
        { id: "c2", type: "MILESTONE", title: "Milestone", milestoneId: "m1", completed: false, met: false },
      ],
      disputeHold: true,
      dispute: {
        id: "d1",
        initiator: "alice",
        reason: "Delayed",
        status: "Open",
        createdAt: 1010,
      },
      history: [],
      createdAt: 1000,
      updatedAt: 1010,
    },
    {
      id: "e3",
      depositor: "dave",
      beneficiary: "bob",
      recipients: [{ address: "bob", amount: 500n }],
      token: "XLM",
      targetAmount: 500n,
      fundedAmount: 500n,
      status: "Funded",
      releaseTriggerType: "MANUAL",
      conditionLogic: "ALL",
      conditions: [],
      disputeHold: false,
      history: [],
      createdAt: 1050,
      updatedAt: 1050,
    },
  ];
}

describe("Escrow Analytics & Reporting", () => {
  it("computes comprehensive summary metrics", () => {
    const escrows = createMockEscrows();
    const report = computeEscrowAnalytics(escrows);

    expect(report.summary.totalEscrows).toBe(3);
    expect(report.summary.releasedEscrows).toBe(1);
    expect(report.summary.disputedEscrows).toBe(1);
    expect(report.summary.activeEscrows).toBe(2); // Funded + Disputed

    // Total Value Locked: active escrows (Disputed 2000 + Funded 500) = 2500
    expect(report.summary.totalValueLocked).toBe(2500n);
    expect(report.summary.totalValueReleased).toBe(1000n);
    expect(report.summary.totalValueDisputed).toBe(2000n);

    expect(report.byStatus.Released).toBe(1);
    expect(report.byStatus.Disputed).toBe(1);
    expect(report.byStatus.Funded).toBe(1);

    expect(report.byConditionType.TIME_LOCK.total).toBe(1);
    expect(report.byConditionType.TIME_LOCK.met).toBe(1);
    expect(report.byConditionType.TIME_LOCK.passRatePercentage).toBe(100);

    expect(report.byConditionType.MILESTONE.total).toBe(1);
    expect(report.byConditionType.MILESTONE.met).toBe(0);
    expect(report.byConditionType.MILESTONE.passRatePercentage).toBe(0);

    expect(report.byToken.USDC.count).toBe(2);
    expect(report.byToken.XLM.count).toBe(1);
  });

  it("filters escrows accurately", () => {
    const escrows = createMockEscrows();
    const xlmFiltered = filterEscrows(escrows, { token: "XLM" });
    expect(xlmFiltered.length).toBe(1);
    expect(xlmFiltered[0].id).toBe("e3");

    const statusFiltered = filterEscrows(escrows, { status: "Released" });
    expect(statusFiltered.length).toBe(1);
    expect(statusFiltered[0].id).toBe("e1");
  });

  it("generates formatted Markdown report", () => {
    const escrows = createMockEscrows();
    const report = computeEscrowAnalytics(escrows);
    const md = generateEscrowMarkdownReport(report);

    expect(md).toContain("# Escrow Analytics & Performance Report");
    expect(md).toContain("Total Value Locked (TVL)");
    expect(md).toContain("Dispute Rate");
    expect(md).toContain("Condition Evaluation Pass Rates");
    expect(md).toContain("Volume by Token");
  });
});
