/**
 * Escrow Release Trigger System
 *
 * Implements condition evaluation verification, automated release execution,
 * manual release enforcement, dispute safety gating, and payout distribution.
 */

import type {
  ConditionEvaluationContext,
  EscrowContract,
  EscrowPayout,
  ReleaseExecution,
  ReleaseResult,
} from "@/types/escrow";
import { evaluateConditions } from "./conditionEngine";
import { isDisputeHoldActive } from "./disputeHold";
import { EscrowDisputeHoldError, transitionEscrowState } from "./stateMachine";

/**
 * Calculates payout distributions across recipients.
 */
export function calculatePayouts(
  escrow: EscrowContract,
  txHashPrefix: string,
  now: number
): EscrowPayout[] {
  const totalFunded = escrow.fundedAmount;

  // Handle dispute split outcome if applicable
  if (
    escrow.dispute?.status === "ResolvedSplit" &&
    escrow.dispute.splitRatio
  ) {
    const { beneficiaryPercentage, depositorPercentage } =
      escrow.dispute.splitRatio;

    const beneficiaryAmount =
      (totalFunded * BigInt(Math.floor(beneficiaryPercentage * 100))) / 10000n;
    const depositorAmount = totalFunded - beneficiaryAmount;

    return [
      {
        recipient: escrow.beneficiary,
        amount: beneficiaryAmount,
        txHash: `${txHashPrefix}_beneficiary`,
        timestamp: now,
      },
      {
        recipient: escrow.depositor,
        amount: depositorAmount,
        txHash: `${txHashPrefix}_depositor_refund`,
        timestamp: now,
      },
    ];
  }

  // Multi-recipient distribution
  if (escrow.recipients && escrow.recipients.length > 0) {
    const totalRecipientsTarget: bigint = escrow.recipients.reduce(
      (acc: bigint, r) => acc + BigInt(r.amount),
      0n
    );

    if (totalRecipientsTarget > 0n) {
      let distributed = 0n;
      const payouts: EscrowPayout[] = escrow.recipients.map((r, idx) => {
        const isLast = idx === escrow.recipients.length - 1;
        const share: bigint = isLast
          ? totalFunded - distributed
          : (totalFunded * BigInt(r.amount)) / totalRecipientsTarget;

        distributed += share;
        return {
          recipient: r.address,
          amount: share,
          txHash: `${txHashPrefix}_rec_${idx + 1}`,
          timestamp: now,
        };
      });
      return payouts;
    }
  }

  // Single beneficiary default
  return [
    {
      recipient: escrow.beneficiary,
      amount: totalFunded,
      txHash: `${txHashPrefix}_payout`,
      timestamp: now,
    },
  ];
}

/**
 * Evaluates conditions and triggers automated release if conditions are satisfied and no dispute exists.
 */
export function attemptReleaseTrigger(
  escrow: EscrowContract,
  context: ConditionEvaluationContext = {},
  options: {
    actor?: string;
    forceManual?: boolean;
    now?: number;
  } = {}
): {
  result: ReleaseResult;
  updatedEscrow: EscrowContract;
} {
  const now = options.now ?? Math.floor(Date.now() / 1000);

  // 1. Invariant check: DISPUTES PREVENT RELEASE
  if (isDisputeHoldActive(escrow)) {
    return {
      result: {
        success: false,
        released: false,
        blockedByDispute: true,
        error: `Release blocked: Escrow ${escrow.id} is held under an active dispute. All payouts are halted.`,
      },
      updatedEscrow: escrow,
    };
  }

  // Already released check
  if (escrow.status === "Released") {
    return {
      result: {
        success: true,
        released: true,
        txHash: escrow.releaseExecution?.txHash,
        payouts: escrow.releaseExecution?.payouts,
      },
      updatedEscrow: escrow,
    };
  }

  // Funding requirement check
  if (escrow.fundedAmount <= 0n) {
    return {
      result: {
        success: false,
        released: false,
        error: `Cannot release escrow ${escrow.id}: No funds deposited (fundedAmount is 0).`,
      },
      updatedEscrow: escrow,
    };
  }

  // 2. Condition evaluation
  const evalResult = evaluateConditions(
    escrow.conditions,
    escrow.conditionLogic,
    {
      ...context,
      currentTimestamp: now,
      fundedAmount: escrow.fundedAmount,
    },
    escrow.thresholdCount
  );

  // Update met flags on condition objects
  const updatedConditions = escrow.conditions.map((c) => {
    const singleResult = evalResult.conditionResults.find(
      (r) => r.conditionId === c.id
    );
    if (!singleResult) return c;
    return {
      ...c,
      met: singleResult.met,
      evaluatedAt: singleResult.evaluatedAt,
      failureReason: singleResult.reason,
      metAt: singleResult.met ? c.metAt ?? now : undefined,
    };
  });

  const withUpdatedConditions: EscrowContract = {
    ...escrow,
    conditions: updatedConditions,
  };

  if (!evalResult.canRelease) {
    return {
      result: {
        success: false,
        released: false,
        blockedByDispute: false,
        failureReasons: evalResult.failureReasons,
        error: `Release conditions not met: ${evalResult.failureReasons.join("; ")}`,
      },
      updatedEscrow: withUpdatedConditions,
    };
  }

  // 3. Trigger Mode Handling
  const shouldExecuteRelease =
    escrow.releaseTriggerType === "AUTOMATIC" || options.forceManual;

  if (shouldExecuteRelease) {
    const txHash = `0xescrow_${escrow.id.replace(/[^a-zA-Z0-9]/g, "")}_${now.toString(16)}`;
    const payouts = calculatePayouts(escrow, txHash, now);

    const releaseExecution: ReleaseExecution = {
      triggeredBy: options.actor ?? "system_auto_trigger",
      triggeredAt: now,
      triggerType: options.forceManual ? "MANUAL" : escrow.releaseTriggerType,
      txHash,
      payouts,
    };

    const releasedEscrow = transitionEscrowState(
      {
        ...withUpdatedConditions,
        releaseExecution,
      },
      "Released",
      {
        actor: options.actor ?? "automated_release_engine",
        reason: options.forceManual
          ? "Manual release trigger executed after conditions verified"
          : "Automated release trigger: all conditions satisfied and no dispute hold",
        timestamp: now,
      }
    );

    return {
      result: {
        success: true,
        released: true,
        txHash,
        payouts,
      },
      updatedEscrow: releasedEscrow,
    };
  }

  // Manual trigger mode: Mark ReadyForRelease if in Funded or Evaluating
  let readyEscrow = withUpdatedConditions;
  if (
    withUpdatedConditions.status === "Funded" ||
    withUpdatedConditions.status === "Evaluating"
  ) {
    readyEscrow = transitionEscrowState(withUpdatedConditions, "ReadyForRelease", {
      actor: options.actor ?? "condition_evaluator",
      reason: "All release conditions satisfied; awaiting manual release trigger",
      timestamp: now,
    });
  }

  return {
    result: {
      success: true,
      released: false,
      readyForRelease: true,
    },
    updatedEscrow: readyEscrow,
  };
}

/**
 * Manually executes release for an authorized actor (depositor, beneficiary, or recipient).
 */
export function executeManualRelease(
  escrow: EscrowContract,
  actor: string,
  context: ConditionEvaluationContext = {},
  now?: number
): {
  result: ReleaseResult;
  updatedEscrow: EscrowContract;
} {
  if (isDisputeHoldActive(escrow)) {
    throw new EscrowDisputeHoldError(
      `Cannot manually release escrow ${escrow.id}: Active dispute hold is in effect.`
    );
  }

  const isAuthorized =
    escrow.depositor === actor ||
    escrow.beneficiary === actor ||
    escrow.recipients?.some((r) => r.address === actor);

  if (!isAuthorized) {
    throw new Error(
      `Unauthorized: Address "${actor}" is not a party to escrow ${escrow.id}.`
    );
  }

  return attemptReleaseTrigger(escrow, context, {
    actor,
    forceManual: true,
    now,
  });
}
