/**
 * Escrow Contract Service
 *
 * Implements IEscrowContractService coordinating lifecycle transitions,
 * condition evaluation, automated/manual release triggers, dispute holds,
 * persistence, and analytics.
 */

import type {
  ConditionEvaluationContext,
  ConditionEvaluationResult,
  CreateEscrowInput,
  EscrowAnalyticsFilter,
  EscrowAnalyticsReport,
  EscrowCondition,
  EscrowContract,
  EscrowRecipient,
  IEscrowContractService,
  RaiseDisputeInput,
  ReleaseResult,
  ResolveDisputeInput,
} from "@/types/escrow";
import { computeEscrowAnalytics } from "./analytics";
import { evaluateConditions } from "./conditionEngine";
import { isDisputeHoldActive, raiseDispute, resolveDispute } from "./disputeHold";
import { attemptReleaseTrigger, executeManualRelease } from "./releaseTrigger";
import {
  EscrowDisputeHoldError,
  EscrowStateError,
  transitionEscrowState,
} from "./stateMachine";

export const ESCROW_STORAGE_KEY = "stellar_split_escrow_contracts";

export class EscrowService implements IEscrowContractService {
  private escrows: Map<string, EscrowContract> = new Map();

  constructor(initialEscrows?: EscrowContract[]) {
    if (initialEscrows && initialEscrows.length > 0) {
      initialEscrows.forEach((e) => this.escrows.set(e.id, e));
    } else {
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const data = localStorage.getItem(ESCROW_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data, (_, val) => {
          if (typeof val === "string" && /^\d+n$/.test(val)) {
            return BigInt(val.slice(0, -1));
          }
          return val;
        }) as EscrowContract[];

        parsed.forEach((e) => {
          // Ensure bigint fields are properly converted
          e.targetAmount = BigInt(e.targetAmount);
          e.fundedAmount = BigInt(e.fundedAmount);
          if (e.recipients) {
            e.recipients.forEach((r) => {
              r.amount = BigInt(r.amount);
            });
          }
          if (e.releaseExecution?.payouts) {
            e.releaseExecution.payouts.forEach((p) => {
              p.amount = BigInt(p.amount);
            });
          }
          this.escrows.set(e.id, e);
        });
      }
    } catch {
      // Storage failure graceful fallback to in-memory
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const all = Array.from(this.escrows.values());
      const serialized = JSON.stringify(all, (_, val) =>
        typeof val === "bigint" ? `${val.toString()}n` : val
      );
      localStorage.setItem(ESCROW_STORAGE_KEY, serialized);
    } catch {
      // Ignore storage write errors
    }
  }

  /**
   * Creates a new escrow payment contract.
   */
  public createEscrow(input: CreateEscrowInput): EscrowContract {
    const now = Math.floor(Date.now() / 1000);
    const id = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const initialDeposit = input.initialDeposit ?? 0n;
    const isFullyFunded = initialDeposit >= input.targetAmount && input.targetAmount > 0n;
    const initialStatus = isFullyFunded ? "Funded" : "Created";

    // Setup recipients
    let recipients: EscrowRecipient[] = input.recipients || [];
    if (recipients.length === 0) {
      recipients = [
        {
          address: input.beneficiary,
          amount: input.targetAmount,
          name: "Primary Beneficiary",
          sharePercentage: 100,
        },
      ];
    }

    const escrow: EscrowContract = {
      id,
      invoiceId: input.invoiceId,
      depositor: input.depositor,
      beneficiary: input.beneficiary,
      recipients,
      token: input.token || "USDC",
      targetAmount: input.targetAmount,
      fundedAmount: initialDeposit,
      status: initialStatus,
      releaseTriggerType: input.releaseTriggerType || "AUTOMATIC",
      conditionLogic: input.conditionLogic || "ALL",
      thresholdCount: input.thresholdCount,
      conditions: input.conditions || [],
      disputeHold: false,
      history: [
        {
          id: `hist_init_${id}`,
          from: "Created",
          to: initialStatus,
          timestamp: now,
          actor: input.depositor,
          reason: "Escrow payment contract initialized",
        },
      ],
      createdAt: now,
      updatedAt: now,
      fundedAt: isFullyFunded ? now : undefined,
      metadata: input.metadata,
    };

    this.escrows.set(id, escrow);

    // If fully funded and automatic release, evaluate immediately
    let finalEscrow = escrow;
    if (isFullyFunded && escrow.releaseTriggerType === "AUTOMATIC") {
      const { updatedEscrow } = attemptReleaseTrigger(escrow, {}, { now });
      finalEscrow = updatedEscrow;
      this.escrows.set(id, finalEscrow);
    }

    this.saveToStorage();
    return finalEscrow;
  }

  public getEscrow(id: string): EscrowContract | null {
    return this.escrows.get(id) || null;
  }

  public listEscrows(filter?: EscrowAnalyticsFilter): EscrowContract[] {
    const all = Array.from(this.escrows.values());
    if (!filter) return all;

    return all.filter((e) => {
      if (filter.startDate && e.createdAt < filter.startDate) return false;
      if (filter.endDate && e.createdAt > filter.endDate) return false;
      if (filter.token && e.token !== filter.token) return false;
      if (filter.depositor && e.depositor !== filter.depositor) return false;
      if (filter.beneficiary && e.beneficiary !== filter.beneficiary) return false;
      if (filter.status && e.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * Deposits funds toward an escrow.
   */
  public fundEscrow(id: string, amount: bigint, payer: string): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    if (["Released", "Refunded", "Cancelled"].includes(escrow.status)) {
      throw new EscrowStateError(
        `Cannot fund escrow ${id} in terminal state "${escrow.status}".`
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const newFundedAmount = escrow.fundedAmount + amount;
    const isNowFunded = newFundedAmount >= escrow.targetAmount;

    let updated = {
      ...escrow,
      fundedAmount: newFundedAmount,
      updatedAt: now,
    };

    if (updated.status === "Created" && isNowFunded) {
      updated = transitionEscrowState(updated, "Funded", {
        actor: payer,
        reason: `Escrow target funding reached: ${newFundedAmount.toString()} stroops deposited`,
        timestamp: now,
      });
    }

    // If automatic release mode, check if conditions are met
    if (updated.status === "Funded" && updated.releaseTriggerType === "AUTOMATIC") {
      const { updatedEscrow } = attemptReleaseTrigger(updated, {}, { actor: payer, now });
      updated = updatedEscrow;
    }

    this.escrows.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Updates an individual condition.
   */
  public updateCondition(
    id: string,
    conditionId: string,
    update: Partial<EscrowCondition>,
    actor?: string
  ): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const now = Math.floor(Date.now() / 1000);
    const updatedConditions = escrow.conditions.map((c) => {
      if (c.id !== conditionId) return c;
      const merged = { ...c, ...update } as EscrowCondition;
      if (update.met && !c.met) {
        merged.metAt = now;
      }
      return merged;
    });

    let updated: EscrowContract = {
      ...escrow,
      conditions: updatedConditions,
      updatedAt: now,
    };

    // Auto-release check
    if (
      ["Funded", "Evaluating", "ReadyForRelease"].includes(updated.status) &&
      updated.releaseTriggerType === "AUTOMATIC" &&
      !isDisputeHoldActive(updated)
    ) {
      const { updatedEscrow } = attemptReleaseTrigger(updated, {}, { actor, now });
      updated = updatedEscrow;
    }

    this.escrows.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Adds approval signature to an APPROVAL condition.
   */
  public addApprovalSignature(
    id: string,
    conditionId: string,
    signer: string
  ): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const cond = escrow.conditions.find((c) => c.id === conditionId);
    if (!cond || cond.type !== "APPROVAL") {
      throw new Error(`Approval condition ${conditionId} not found on escrow ${id}.`);
    }

    const currentSigs = cond.currentSignatures || [];
    if (!currentSigs.includes(signer)) {
      currentSigs.push(signer);
    }

    const met = currentSigs.length >= cond.minSignatures;

    return this.updateCondition(
      id,
      conditionId,
      {
        currentSignatures: currentSigs,
        met,
      },
      signer
    );
  }

  /**
   * Marks a milestone as completed.
   */
  public completeMilestone(
    id: string,
    conditionId: string,
    verifiedBy?: string,
    proofUrl?: string
  ): EscrowContract {
    const now = Math.floor(Date.now() / 1000);
    return this.updateCondition(
      id,
      conditionId,
      {
        completed: true,
        completedAt: now,
        verifiedBy,
        proofUrl,
        met: true,
      },
      verifiedBy
    );
  }

  /**
   * Evaluates conditions and triggers automated release if conditions are satisfied.
   */
  public evaluateConditions(
    id: string,
    context?: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const now = context?.currentTimestamp ?? Math.floor(Date.now() / 1000);
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

    // If automatic release and conditions met and not disputed, trigger release!
    if (
      evalResult.canRelease &&
      escrow.releaseTriggerType === "AUTOMATIC" &&
      ["Funded", "Evaluating", "ReadyForRelease"].includes(escrow.status) &&
      !isDisputeHoldActive(escrow)
    ) {
      const { updatedEscrow } = attemptReleaseTrigger(escrow, context, { now });
      this.escrows.set(id, updatedEscrow);
      this.saveToStorage();
    }

    return evalResult;
  }

  /**
   * Triggers release of escrow funds.
   */
  public triggerRelease(
    id: string,
    actor: string,
    force: boolean = false
  ): ReleaseResult {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    if (isDisputeHoldActive(escrow)) {
      throw new EscrowDisputeHoldError(
        `Release blocked: Escrow ${id} is held under an active dispute.`
      );
    }

    const { result, updatedEscrow } = force
      ? attemptReleaseTrigger(escrow, {}, { actor, forceManual: true })
      : executeManualRelease(escrow, actor);

    this.escrows.set(id, updatedEscrow);
    this.saveToStorage();
    return result;
  }

  /**
   * Raises a dispute against an escrow contract.
   */
  public raiseDispute(id: string, input: RaiseDisputeInput): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const updated = raiseDispute(escrow, input);
    this.escrows.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Resolves an active dispute.
   */
  public resolveDispute(id: string, input: ResolveDisputeInput): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const { escrow: updated, outcome } = resolveDispute(escrow, input);

    let finalEscrow = updated;
    if (outcome === "RELEASE" || outcome === "SPLIT") {
      // Execute release for the resolved escrow
      const { updatedEscrow } = attemptReleaseTrigger(
        updated,
        {},
        { actor: input.resolver, forceManual: true }
      );
      finalEscrow = updatedEscrow;
    }

    this.escrows.set(id, finalEscrow);
    this.saveToStorage();
    return finalEscrow;
  }

  /**
   * Refunds escrow funds back to depositor.
   */
  public refundEscrow(id: string, actor: string, reason?: string): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const now = Math.floor(Date.now() / 1000);
    const txHash = `0xrefund_${escrow.id.replace(/[^a-zA-Z0-9]/g, "")}_${now.toString(16)}`;

    const refunded = transitionEscrowState(escrow, "Refunded", {
      actor,
      reason: reason || "Manual refund executed",
      timestamp: now,
    });

    refunded.refundExecution = {
      recipient: escrow.depositor,
      amount: escrow.fundedAmount,
      refundedBy: actor,
      refundedAt: now,
      reason,
      txHash,
    };

    this.escrows.set(id, refunded);
    this.saveToStorage();
    return refunded;
  }

  /**
   * Cancels an unfunded escrow.
   */
  public cancelEscrow(id: string, actor: string, reason?: string): EscrowContract {
    const escrow = this.getEscrow(id);
    if (!escrow) throw new Error(`Escrow ${id} not found.`);

    const cancelled = transitionEscrowState(escrow, "Cancelled", {
      actor,
      reason: reason || "Escrow cancelled by depositor before funding",
    });

    this.escrows.set(id, cancelled);
    this.saveToStorage();
    return cancelled;
  }

  /**
   * Returns analytics and reporting metrics.
   */
  public getAnalytics(filter?: EscrowAnalyticsFilter): EscrowAnalyticsReport {
    const all = Array.from(this.escrows.values());
    return computeEscrowAnalytics(all, filter);
  }
}

// Global default singleton instance
export const escrowService = new EscrowService();
