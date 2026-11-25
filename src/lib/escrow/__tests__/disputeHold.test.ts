import { describe, expect, it } from "vitest";
import {
  isDisputeHoldActive,
  raiseDispute,
  resolveDispute,
} from "../disputeHold";
import { EscrowStateError } from "../stateMachine";
import type { EscrowContract } from "@/types/escrow";

function createMockEscrow(overrides: Partial<EscrowContract> = {}): EscrowContract {
  return {
    id: "escrow_disp_1",
    depositor: "alice",
    beneficiary: "bob",
    recipients: [{ address: "bob", amount: 1000n }],
    token: "USDC",
    targetAmount: 1000n,
    fundedAmount: 1000n,
    status: "Funded",
    releaseTriggerType: "AUTOMATIC",
    conditionLogic: "ALL",
    conditions: [],
    disputeHold: false,
    history: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("Dispute Hold Mechanism", () => {
  it("raises dispute, applies disputeHold flag, and transitions to Disputed", () => {
    const escrow = createMockEscrow();
    const disputed = raiseDispute(escrow, {
      initiator: "alice",
      reason: "Defective delivery",
      evidenceCids: ["QmHash1"],
    });

    expect(isDisputeHoldActive(disputed)).toBe(true);
    expect(disputed.status).toBe("Disputed");
    expect(disputed.disputeHold).toBe(true);
    expect(disputed.dispute?.initiator).toBe("alice");
    expect(disputed.dispute?.reason).toBe("Defective delivery");
    expect(disputed.dispute?.evidenceCids).toContain("QmHash1");
  });

  it("prohibits raising dispute on finalized escrow", () => {
    const released = createMockEscrow({ status: "Released" });
    expect(() =>
      raiseDispute(released, { initiator: "alice", reason: "Too late" })
    ).toThrow(EscrowStateError);
  });

  it("resolves dispute with outcome RELEASE", () => {
    const escrow = createMockEscrow();
    const disputed = raiseDispute(escrow, {
      initiator: "alice",
      reason: "Delay",
    });

    const { escrow: resolved } = resolveDispute(disputed, {
      resolver: "arbitrator_judy",
      outcome: "RELEASE",
      notes: "Goods delivered in full",
    });

    expect(resolved.disputeHold).toBe(false);
    expect(resolved.status).toBe("ReadyForRelease");
    expect(resolved.dispute?.status).toBe("ResolvedRelease");
    expect(resolved.dispute?.resolvedBy).toBe("arbitrator_judy");
  });

  it("resolves dispute with outcome REFUND", () => {
    const escrow = createMockEscrow();
    const disputed = raiseDispute(escrow, {
      initiator: "alice",
      reason: "Item not sent",
    });

    const { escrow: resolved } = resolveDispute(disputed, {
      resolver: "arbitrator_judy",
      outcome: "REFUND",
      notes: "Full refund to buyer",
    });

    expect(resolved.disputeHold).toBe(false);
    expect(resolved.status).toBe("Refunded");
    expect(resolved.dispute?.status).toBe("ResolvedRefund");
  });

  it("resolves dispute with outcome SPLIT", () => {
    const escrow = createMockEscrow();
    const disputed = raiseDispute(escrow, {
      initiator: "alice",
      reason: "Partial completion",
    });

    const { escrow: resolved } = resolveDispute(disputed, {
      resolver: "arbitrator_judy",
      outcome: "SPLIT",
      notes: "Split 50/50",
      splitRatio: {
        beneficiaryPercentage: 50,
        depositorPercentage: 50,
      },
    });

    expect(resolved.disputeHold).toBe(false);
    expect(resolved.status).toBe("ReadyForRelease");
    expect(resolved.dispute?.status).toBe("ResolvedSplit");
    expect(resolved.dispute?.splitRatio?.beneficiaryPercentage).toBe(50);
  });
});
