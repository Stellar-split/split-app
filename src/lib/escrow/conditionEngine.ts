/**
 * Escrow Condition Evaluation Engine
 *
 * Evaluates individual and composite conditions including time locks,
 * milestone completions, multi-signature approvals, oracle metrics,
 * funding thresholds, and custom predicates.
 */

import type {
  ApprovalCondition,
  ConditionEvaluationContext,
  ConditionEvaluationResult,
  ConditionLogic,
  CustomCondition,
  EscrowCondition,
  MilestoneCondition,
  OracleCondition,
  SingleConditionResult,
  ThresholdCondition,
  TimeLockCondition,
} from "@/types/escrow";

/**
 * Evaluates a TimeLockCondition against the provided timestamp.
 */
export function evaluateTimeLock(
  condition: TimeLockCondition,
  currentTimestamp: number
): { met: boolean; reason?: string } {
  if (currentTimestamp >= condition.releaseTimestamp) {
    return { met: true };
  }
  const remainingSeconds = condition.releaseTimestamp - currentTimestamp;
  return {
    met: false,
    reason: `Time lock active: ${remainingSeconds}s remaining until release (unlocks at ${new Date(
      condition.releaseTimestamp * 1000
    ).toISOString()})`,
  };
}

/**
 * Evaluates a MilestoneCondition.
 */
export function evaluateMilestone(
  condition: MilestoneCondition,
  context?: ConditionEvaluationContext
): { met: boolean; reason?: string } {
  const isCompleted =
    context?.milestoneCompletions?.[condition.milestoneId] ?? condition.completed;

  if (isCompleted) {
    return { met: true };
  }
  return {
    met: false,
    reason: `Milestone "${condition.title}" (ID: ${condition.milestoneId}) is not yet marked completed`,
  };
}

/**
 * Evaluates an ApprovalCondition (multi-signature / authorized approvals).
 */
export function evaluateApproval(
  condition: ApprovalCondition,
  context?: ConditionEvaluationContext
): { met: boolean; reason?: string } {
  const contextSignatures = context?.approvals?.[condition.id];
  const combinedSignatures = Array.from(
    new Set([...(condition.currentSignatures || []), ...(contextSignatures || [])])
  );

  // Validate that signatures come from requiredSigners if requiredSigners is populated
  const validSignatures =
    condition.requiredSigners.length > 0
      ? combinedSignatures.filter((s) => condition.requiredSigners.includes(s))
      : combinedSignatures;

  if (validSignatures.length >= condition.minSignatures) {
    return { met: true };
  }

  const missing = condition.minSignatures - validSignatures.length;
  return {
    met: false,
    reason: `Approval requirement not met: collected ${validSignatures.length}/${condition.minSignatures} required signatures (${missing} missing)`,
  };
}

/**
 * Evaluates an OracleCondition against incoming oracle feeds.
 */
export function evaluateOracle(
  condition: OracleCondition,
  context?: ConditionEvaluationContext
): { met: boolean; reason?: string } {
  const oracleFeed = context?.oracleData?.[condition.oracleAddress];
  const metricVal =
    oracleFeed?.[condition.metricKey] ?? condition.currentValue;

  if (metricVal === undefined || metricVal === null) {
    return {
      met: false,
      reason: `Oracle data unavailable for address ${condition.oracleAddress} metric ${condition.metricKey}`,
    };
  }

  const expected = condition.expectedValue;
  let matches = false;

  switch (condition.operator) {
    case "eq":
      matches = metricVal === expected;
      break;
    case "neq":
      matches = metricVal !== expected;
      break;
    case "gte":
      matches = Number(metricVal) >= Number(expected);
      break;
    case "lte":
      matches = Number(metricVal) <= Number(expected);
      break;
    default:
      matches = metricVal === expected;
  }

  if (matches) {
    return { met: true };
  }

  return {
    met: false,
    reason: `Oracle condition failed: expected ${condition.metricKey} ${condition.operator} ${expected}, got ${metricVal}`,
  };
}

/**
 * Evaluates a ThresholdCondition (e.g. funded balance).
 */
export function evaluateThreshold(
  condition: ThresholdCondition,
  context?: ConditionEvaluationContext
): { met: boolean; reason?: string } {
  const current = context?.fundedAmount ?? condition.currentAmount;
  if (current >= condition.targetAmount) {
    return { met: true };
  }
  return {
    met: false,
    reason: `Threshold not met: current amount (${current.toString()}) is less than target (${condition.targetAmount.toString()})`,
  };
}

/**
 * Evaluates a CustomCondition.
 */
export function evaluateCustom(
  condition: CustomCondition,
  context?: ConditionEvaluationContext
): { met: boolean; reason?: string } {
  const customEvaluator = context?.customEvaluators?.[condition.predicateKey];
  if (customEvaluator) {
    try {
      const ok = customEvaluator(condition, context ?? {});
      return ok
        ? { met: true }
        : { met: false, reason: `Custom predicate "${condition.predicateKey}" returned false` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { met: false, reason: `Custom predicate error: ${msg}` };
    }
  }

  return condition.met
    ? { met: true }
    : { met: false, reason: `Custom condition "${condition.title}" is not met` };
}

/**
 * Evaluates a single condition of any supported type.
 */
export function evaluateSingleCondition(
  condition: EscrowCondition,
  context: ConditionEvaluationContext,
  now: number
): SingleConditionResult {
  let evalResult: { met: boolean; reason?: string };

  switch (condition.type) {
    case "TIME_LOCK":
      evalResult = evaluateTimeLock(condition, now);
      break;
    case "MILESTONE":
      evalResult = evaluateMilestone(condition, context);
      break;
    case "APPROVAL":
      evalResult = evaluateApproval(condition, context);
      break;
    case "ORACLE":
      evalResult = evaluateOracle(condition, context);
      break;
    case "THRESHOLD":
      evalResult = evaluateThreshold(condition, context);
      break;
    case "CUSTOM":
      evalResult = evaluateCustom(condition, context);
      break;
    default:
      evalResult = { met: (condition as EscrowCondition).met };
  }

  return {
    conditionId: condition.id,
    type: condition.type,
    title: condition.title,
    met: evalResult.met,
    reason: evalResult.reason,
    evaluatedAt: now,
  };
}

/**
 * Evaluates an array of conditions according to composite logic (ALL, ANY, THRESHOLD).
 */
export function evaluateConditions(
  conditions: EscrowCondition[],
  logic: ConditionLogic = "ALL",
  context: ConditionEvaluationContext = {},
  thresholdCount?: number
): ConditionEvaluationResult {
  const now = context.currentTimestamp ?? Math.floor(Date.now() / 1000);

  if (!conditions || conditions.length === 0) {
    return {
      canRelease: true,
      allMet: true,
      metCount: 0,
      totalConditions: 0,
      conditionResults: [],
      failureReasons: [],
      evaluatedAt: now,
    };
  }

  const results: SingleConditionResult[] = conditions.map((cond) =>
    evaluateSingleCondition(cond, context, now)
  );

  const metCount = results.filter((r) => r.met).length;
  const failureReasons = results.filter((r) => !r.met).map((r) => r.reason || `${r.title} failed`);
  const allMet = metCount === conditions.length;

  let canRelease = false;

  switch (logic) {
    case "ALL":
      canRelease = allMet;
      break;
    case "ANY":
      canRelease = metCount > 0;
      break;
    case "THRESHOLD": {
      const required = thresholdCount ?? Math.ceil(conditions.length / 2);
      canRelease = metCount >= required;
      break;
    }
  }

  return {
    canRelease,
    allMet,
    metCount,
    totalConditions: conditions.length,
    conditionResults: results,
    failureReasons,
    evaluatedAt: now,
  };
}
