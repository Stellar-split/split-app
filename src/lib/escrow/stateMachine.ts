/**
 * Escrow State Machine & Lifecycle Management
 *
 * Enforces valid state transitions, state transition guards,
 * dispute hold blocks, and lifecycle event logging.
 */

import type {
  EscrowContract,
  EscrowStateHistoryEntry,
  EscrowStatus,
} from "@/types/escrow";

export class EscrowStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscrowStateError";
  }
}

export class EscrowDisputeHoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscrowDisputeHoldError";
  }
}

/**
 * Transition validation mapping from each state to permissible next states.
 */
export const ALLOWED_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  Created: ["Funded", "Cancelled"],
  Funded: ["Evaluating", "ReadyForRelease", "Released", "Disputed", "Refunded"],
  Evaluating: ["ReadyForRelease", "Released", "Disputed", "Refunded"],
  ReadyForRelease: ["Released", "Disputed", "Refunded"],
  Disputed: ["ReadyForRelease", "Released", "Refunded"],
  Released: [],
  Refunded: [],
  Cancelled: [],
};

/**
 * Checks if a transition is structurally permitted by the state transition graph.
 */
export function isTransitionAllowed(from: EscrowStatus, to: EscrowStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates transition invariants and throws appropriate errors if invalid.
 */
export function validateStateTransition(
  escrow: EscrowContract,
  to: EscrowStatus
): void {
  const current = escrow.status;

  // Terminal state check
  if (["Released", "Refunded", "Cancelled"].includes(current)) {
    throw new EscrowStateError(
      `Cannot transition from terminal state "${current}" to "${to}". Escrow is finalized.`
    );
  }

  // Graph validity check
  if (!isTransitionAllowed(current, to)) {
    throw new EscrowStateError(
      `Invalid state transition: Cannot transition from "${current}" to "${to}".`
    );
  }

  // Dispute hold invariant: Cannot transition to Released or ReadyForRelease while disputeHold is active
  if ((to === "Released" || to === "ReadyForRelease") && escrow.disputeHold) {
    throw new EscrowDisputeHoldError(
      `Release blocked: Escrow ${escrow.id} is held under an active dispute. All releases are prohibited until resolved.`
    );
  }

  // Funding check for release
  if (to === "Released" && escrow.fundedAmount <= 0n) {
    throw new EscrowStateError(
      `Cannot transition to "Released": Escrow ${escrow.id} has 0 funded amount.`
    );
  }
}

/**
 * Applies a state transition to an escrow contract, recording history and updating timestamps.
 */
export function transitionEscrowState(
  escrow: EscrowContract,
  to: EscrowStatus,
  options: {
    actor?: string;
    reason?: string;
    timestamp?: number;
  } = {}
): EscrowContract {
  if (escrow.status === to) {
    return escrow;
  }

  validateStateTransition(escrow, to);

  const now = options.timestamp ?? Math.floor(Date.now() / 1000);
  const historyEntry: EscrowStateHistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    from: escrow.status,
    to,
    timestamp: now,
    actor: options.actor,
    reason: options.reason,
  };

  const updated: EscrowContract = {
    ...escrow,
    status: to,
    history: [...(escrow.history || []), historyEntry],
    updatedAt: now,
  };

  switch (to) {
    case "Funded":
      if (!updated.fundedAt) updated.fundedAt = now;
      break;
    case "Released":
      updated.releasedAt = now;
      break;
    case "Refunded":
      updated.refundedAt = now;
      break;
    case "Cancelled":
      updated.cancelledAt = now;
      break;
  }

  return updated;
}
