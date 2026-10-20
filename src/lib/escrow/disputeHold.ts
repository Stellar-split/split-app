/**
 * Escrow Dispute Hold Mechanism
 *
 * Provides dispute initiation, dispute hold enforcement (blocking fund release),
 * evidence attachment, and dispute arbitration resolution.
 */

import type {
  DisputeDetails,
  DisputeStatus,
  EscrowContract,
  RaiseDisputeInput,
  ResolveDisputeInput,
} from "@/types/escrow";
import {
  EscrowDisputeHoldError,
  EscrowStateError,
  transitionEscrowState,
} from "./stateMachine";

/**
 * Checks whether an escrow is held under an active dispute.
 */
export function isDisputeHoldActive(escrow: EscrowContract): boolean {
  return escrow.disputeHold === true || escrow.status === "Disputed";
}

/**
 * Raises a dispute against an escrow contract, immediately locking all releases.
 */
export function raiseDispute(
  escrow: EscrowContract,
  input: RaiseDisputeInput,
  now: number = Math.floor(Date.now() / 1000)
): EscrowContract {
  if (["Released", "Refunded", "Cancelled"].includes(escrow.status)) {
    throw new EscrowStateError(
      `Cannot raise dispute on finalized escrow ${escrow.id} with status "${escrow.status}".`
    );
  }

  if (isDisputeHoldActive(escrow)) {
    // If already disputed, append evidence if provided
    if (input.evidenceCids && escrow.dispute) {
      const combined = Array.from(
        new Set([...(escrow.dispute.evidenceCids || []), ...input.evidenceCids])
      );
      return {
        ...escrow,
        dispute: {
          ...escrow.dispute,
          evidenceCids: combined,
        },
        updatedAt: now,
      };
    }
    return escrow;
  }

  const dispute: DisputeDetails = {
    id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    initiator: input.initiator,
    reason: input.reason,
    evidenceCids: input.evidenceCids || [],
    createdAt: now,
    status: "Open",
  };

  // Flag disputeHold before transition to ensure atomicity
  const heldEscrow: EscrowContract = {
    ...escrow,
    disputeHold: true,
    dispute,
  };

  return transitionEscrowState(heldEscrow, "Disputed", {
    actor: input.initiator,
    reason: `Dispute raised: ${input.reason}`,
    timestamp: now,
  });
}

/**
 * Resolves an active dispute, lifting the hold and applying the resolution outcome.
 */
export function resolveDispute(
  escrow: EscrowContract,
  input: ResolveDisputeInput,
  now: number = Math.floor(Date.now() / 1000)
): {
  escrow: EscrowContract;
  outcome: "RELEASE" | "REFUND" | "SPLIT";
} {
  if (!escrow.dispute || !isDisputeHoldActive(escrow)) {
    throw new EscrowStateError(
      `Escrow ${escrow.id} does not have an active dispute to resolve.`
    );
  }

  let resolvedStatus: DisputeStatus;
  switch (input.outcome) {
    case "RELEASE":
      resolvedStatus = "ResolvedRelease";
      break;
    case "REFUND":
      resolvedStatus = "ResolvedRefund";
      break;
    case "SPLIT":
      resolvedStatus = "ResolvedSplit";
      break;
    default:
      resolvedStatus = "ResolvedRelease";
  }

  const updatedDispute: DisputeDetails = {
    ...escrow.dispute,
    status: resolvedStatus,
    arbitratorNotes: input.notes,
    resolvedAt: now,
    resolvedBy: input.resolver,
    splitRatio: input.splitRatio,
  };

  // Lift the dispute hold
  const holdLifted: EscrowContract = {
    ...escrow,
    disputeHold: false,
    dispute: updatedDispute,
  };

  if (input.outcome === "REFUND") {
    const refunded = transitionEscrowState(holdLifted, "Refunded", {
      actor: input.resolver,
      reason: `Dispute resolved with full refund to depositor: ${input.notes || "Arbitrated refund"}`,
      timestamp: now,
    });
    return { escrow: refunded, outcome: "REFUND" };
  }

  // Outcome is RELEASE or SPLIT: transition to ReadyForRelease so release trigger can execute payouts
  const ready = transitionEscrowState(holdLifted, "ReadyForRelease", {
    actor: input.resolver,
    reason: `Dispute resolved in favor of release: ${input.notes || "Arbitrated release"}`,
    timestamp: now,
  });

  return { escrow: ready, outcome: input.outcome };
}
