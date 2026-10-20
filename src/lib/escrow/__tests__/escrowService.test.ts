import { describe, expect, it } from "vitest";
import { EscrowService } from "../escrowService";
import { EscrowDisputeHoldError } from "../stateMachine";

describe("EscrowService End-to-End Integration", () => {
  it("creates an escrow and funds it", () => {
    const service = new EscrowService([]);
    const escrow = service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 5000n,
    });

    expect(escrow.status).toBe("Created");
    expect(escrow.fundedAmount).toBe(0n);

    const funded = service.fundEscrow(escrow.id, 5000n, "alice");
    expect(funded.status).toBe("Released"); // No conditions & AUTOMATIC trigger -> Released!
    expect(funded.fundedAmount).toBe(5000n);
    expect(funded.releaseExecution).toBeDefined();
  });

  it("evaluates conditions and releases automatically once all conditions are satisfied", () => {
    const service = new EscrowService([]);
    const escrow = service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 1000n,
      initialDeposit: 1000n,
      conditions: [
        {
          id: "m1",
          type: "MILESTONE",
          title: "Complete Backend",
          milestoneId: "mile_backend",
          completed: false,
          met: false,
        },
      ],
      releaseTriggerType: "AUTOMATIC",
    });

    // Funded, but milestone is not complete -> not released yet
    expect(escrow.status).toBe("Funded");

    // Complete the milestone
    const updated = service.completeMilestone(escrow.id, "m1", "auditor");

    // Automatically triggered release!
    expect(updated.status).toBe("Released");
    expect(updated.releaseExecution?.payouts[0].recipient).toBe("bob");
    expect(updated.releaseExecution?.payouts[0].amount).toBe(1000n);
  });

  it("handles multi-signature approvals and triggers release", () => {
    const service = new EscrowService([]);
    const escrow = service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 2000n,
      initialDeposit: 2000n,
      conditions: [
        {
          id: "app1",
          type: "APPROVAL",
          title: "2-of-2 signoff",
          requiredSigners: ["alice", "bob"],
          minSignatures: 2,
          currentSignatures: [],
          met: false,
        },
      ],
      releaseTriggerType: "AUTOMATIC",
    });

    expect(escrow.status).toBe("Funded");

    // First signer
    const afterFirstSig = service.addApprovalSignature(escrow.id, "app1", "alice");
    expect(afterFirstSig.status).toBe("Funded");

    // Second signer triggers release
    const afterSecondSig = service.addApprovalSignature(escrow.id, "app1", "bob");
    expect(afterSecondSig.status).toBe("Released");
  });

  it("ensures dispute hold prevents release until resolved", () => {
    const service = new EscrowService([]);
    const escrow = service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 3000n,
      initialDeposit: 3000n,
      releaseTriggerType: "MANUAL",
    });

    expect(escrow.status).toBe("Funded");

    // Alice raises dispute
    const disputed = service.raiseDispute(escrow.id, {
      initiator: "alice",
      reason: "Defective work delivered",
      evidenceCids: ["QmDisputeEvidence"],
    });

    expect(disputed.status).toBe("Disputed");
    expect(disputed.disputeHold).toBe(true);

    // Attempting manual release while under dispute MUST throw
    expect(() => service.triggerRelease(escrow.id, "bob")).toThrow(
      EscrowDisputeHoldError
    );

    // Resolve dispute in favor of RELEASE
    const resolved = service.resolveDispute(escrow.id, {
      resolver: "mediator_judy",
      outcome: "RELEASE",
      notes: "Defects were addressed by contractor",
    });

    expect(resolved.status).toBe("Released");
    expect(resolved.disputeHold).toBe(false);
    expect(resolved.dispute?.status).toBe("ResolvedRelease");
  });

  it("refunds depositor properly", () => {
    const service = new EscrowService([]);
    const escrow = service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 1000n,
      initialDeposit: 1000n,
      releaseTriggerType: "MANUAL",
    });

    const refunded = service.refundEscrow(escrow.id, "alice", "Mutual cancellation");
    expect(refunded.status).toBe("Refunded");
    expect(refunded.refundExecution?.recipient).toBe("alice");
    expect(refunded.refundExecution?.amount).toBe(1000n);
  });

  it("produces aggregated analytics report", () => {
    const service = new EscrowService([]);
    service.createEscrow({
      depositor: "alice",
      beneficiary: "bob",
      targetAmount: 1000n,
      initialDeposit: 1000n,
    });
    service.createEscrow({
      depositor: "charlie",
      beneficiary: "bob",
      targetAmount: 2000n,
      initialDeposit: 2000n,
      releaseTriggerType: "MANUAL",
    });

    const analytics = service.getAnalytics();
    expect(analytics.summary.totalEscrows).toBe(2);
    expect(analytics.summary.totalValueReleased).toBe(1000n);
    expect(analytics.summary.totalValueLocked).toBe(2000n);
  });
});
