import { describe, expect, it } from "vitest";
import {
  EscrowDisputeHoldError,
  EscrowStateError,
  isTransitionAllowed,
  transitionEscrowState,
  validateStateTransition,
} from "../stateMachine";
import type { EscrowContract } from "@/types/escrow";

function createMockEscrow(overrides: Partial<EscrowContract> = {}): EscrowContract {
  return {
    id: "escrow_test_1",
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

describe("Escrow State Machine", () => {
  it("allows permissible transitions", () => {
    expect(isTransitionAllowed("Created", "Funded")).toBe(true);
    expect(isTransitionAllowed("Funded", "ReadyForRelease")).toBe(true);
    expect(isTransitionAllowed("ReadyForRelease", "Released")).toBe(true);
    expect(isTransitionAllowed("Funded", "Disputed")).toBe(true);
    expect(isTransitionAllowed("Disputed", "Refunded")).toBe(true);
  });

  it("prohibits invalid transitions", () => {
    expect(isTransitionAllowed("Created", "Released")).toBe(false);
    expect(isTransitionAllowed("Released", "Funded")).toBe(false);
    expect(isTransitionAllowed("Refunded", "Released")).toBe(false);
  });

  it("throws EscrowStateError on invalid state transition", () => {
    const escrow = createMockEscrow({ status: "Created" });
    expect(() => validateStateTransition(escrow, "Released")).toThrow(EscrowStateError);
  });

  it("throws EscrowStateError when attempting to transition from terminal state", () => {
    const escrow = createMockEscrow({ status: "Released" });
    expect(() => validateStateTransition(escrow, "Refunded")).toThrow(EscrowStateError);
  });

  it("throws EscrowDisputeHoldError when transitioning to Released or ReadyForRelease during active dispute", () => {
    const disputedEscrow = createMockEscrow({
      status: "Disputed",
      disputeHold: true,
    });
    expect(() => validateStateTransition(disputedEscrow, "Released")).toThrow(
      EscrowDisputeHoldError
    );
    expect(() => validateStateTransition(disputedEscrow, "ReadyForRelease")).toThrow(
      EscrowDisputeHoldError
    );
  });

  it("records state history entry and updates timestamps upon transition", () => {
    const escrow = createMockEscrow({ status: "Funded" });
    const updated = transitionEscrowState(escrow, "ReadyForRelease", {
      actor: "evaluator",
      reason: "All conditions verified",
      timestamp: 1200,
    });

    expect(updated.status).toBe("ReadyForRelease");
    expect(updated.updatedAt).toBe(1200);
    expect(updated.history.length).toBe(1);
    expect(updated.history[0].from).toBe("Funded");
    expect(updated.history[0].to).toBe("ReadyForRelease");
    expect(updated.history[0].actor).toBe("evaluator");
    expect(updated.history[0].reason).toBe("All conditions verified");
  });
});
