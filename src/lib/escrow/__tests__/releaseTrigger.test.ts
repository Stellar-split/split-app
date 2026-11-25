import { describe, expect, it } from "vitest";
import {
  attemptReleaseTrigger,
  calculatePayouts,
  executeManualRelease,
} from "../releaseTrigger";
import { EscrowDisputeHoldError } from "../stateMachine";
import type { EscrowContract } from "@/types/escrow";

function createMockEscrow(overrides: Partial<EscrowContract> = {}): EscrowContract {
  return {
    id: "escrow_rel_1",
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

describe("Release Trigger System", () => {
  it("automatically releases funds when conditions are met and no dispute is active", () => {
    const escrow = createMockEscrow();
    const { result, updatedEscrow } = attemptReleaseTrigger(escrow);

    expect(result.success).toBe(true);
    expect(result.released).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(result.payouts?.length).toBe(1);
    expect(result.payouts?.[0].recipient).toBe("bob");
    expect(result.payouts?.[0].amount).toBe(1000n);
    expect(updatedEscrow.status).toBe("Released");
    expect(updatedEscrow.releaseExecution).toBeDefined();
  });

  it("actively BLOCKS release when dispute is active", () => {
    const disputedEscrow = createMockEscrow({
      status: "Disputed",
      disputeHold: true,
    });

    const { result, updatedEscrow } = attemptReleaseTrigger(disputedEscrow);
    expect(result.success).toBe(false);
    expect(result.released).toBe(false);
    expect(result.blockedByDispute).toBe(true);
    expect(result.error).toContain("active dispute");
    expect(updatedEscrow.status).toBe("Disputed");

    // Manual release must throw EscrowDisputeHoldError
    expect(() => executeManualRelease(disputedEscrow, "alice")).toThrow(
      EscrowDisputeHoldError
    );
  });

  it("halts release when conditions are pending", () => {
    const escrow = createMockEscrow({
      conditions: [
        {
          id: "c1",
          type: "TIME_LOCK",
          title: "Lock",
          releaseTimestamp: 5000,
          met: false,
        },
      ],
    });

    const { result, updatedEscrow } = attemptReleaseTrigger(escrow, {}, { now: 1000 });
    expect(result.success).toBe(false);
    expect(result.released).toBe(false);
    expect(result.blockedByDispute).toBe(false);
    expect(result.failureReasons?.length).toBe(1);
    expect(updatedEscrow.status).toBe("Funded");
  });

  it("sets ReadyForRelease when releaseTriggerType is MANUAL", () => {
    const manualEscrow = createMockEscrow({
      releaseTriggerType: "MANUAL",
      conditions: [],
    });

    const { result, updatedEscrow } = attemptReleaseTrigger(manualEscrow);
    expect(result.success).toBe(true);
    expect(result.released).toBe(false);
    expect(result.readyForRelease).toBe(true);
    expect(updatedEscrow.status).toBe("ReadyForRelease");

    // Now execute manual release with authorized actor
    const manualResult = executeManualRelease(updatedEscrow, "alice");
    expect(manualResult.result.success).toBe(true);
    expect(manualResult.result.released).toBe(true);
    expect(manualResult.updatedEscrow.status).toBe("Released");
  });

  it("calculates multi-recipient payouts proportionally", () => {
    const multiRecipientEscrow = createMockEscrow({
      fundedAmount: 1000n,
      recipients: [
        { address: "bob", amount: 600n },
        { address: "carol", amount: 400n },
      ],
    });

    const payouts = calculatePayouts(multiRecipientEscrow, "0xtx", 1000);
    expect(payouts.length).toBe(2);
    expect(payouts[0].recipient).toBe("bob");
    expect(payouts[0].amount).toBe(600n);
    expect(payouts[1].recipient).toBe("carol");
    expect(payouts[1].amount).toBe(400n);
  });

  it("calculates dispute split payouts when resolved with split", () => {
    const splitEscrow = createMockEscrow({
      fundedAmount: 1000n,
      dispute: {
        id: "d1",
        initiator: "alice",
        reason: "dispute",
        status: "ResolvedSplit",
        createdAt: 1000,
        splitRatio: {
          beneficiaryPercentage: 70,
          depositorPercentage: 30,
        },
      },
    });

    const payouts = calculatePayouts(splitEscrow, "0xtx", 1000);
    expect(payouts.length).toBe(2);
    expect(payouts[0].recipient).toBe("bob");
    expect(payouts[0].amount).toBe(700n);
    expect(payouts[1].recipient).toBe("alice");
    expect(payouts[1].amount).toBe(300n);
  });
});
