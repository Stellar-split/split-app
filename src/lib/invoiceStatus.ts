import {
  areMilestoneConditionsSatisfied,
  getInvoiceMilestones,
} from "./invoiceMilestones";
import { getActiveDispute } from "./invoiceDisputes";

export type InvoiceStatus =
  | "Pending"
  | "Active"
  | "Funded"
  | "Released"
  | "Refunded"
  | "Disputed"
  | "Frozen"
  | "Archived"
  | "Expired";

export interface StatusConfig {
  label: string;
  colorClass: string;
  icon?: string;
  description: string;
}

export const STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  Pending: {
    label: "Pending",
    colorClass: "bg-yellow-500/20 text-yellow-400",
    icon: "⏳",
    description: "Waiting for recipient action or payment initiation",
  },
  Active: {
    label: "Active",
    colorClass: "bg-blue-500/20 text-blue-400",
    description: "Invoice is currently active and awaiting payment",
  },
  Funded: {
    label: "Funded",
    colorClass: "bg-cyan-500/20 text-cyan-400",
    description: "Invoice has been funded but not yet released",
  },
  Released: {
    label: "Released",
    colorClass: "bg-green-500/20 text-green-400",
    icon: "✓",
    description: "Payment has been successfully released to recipient",
  },
  Refunded: {
    label: "Refunded",
    colorClass: "bg-gray-500/20 text-gray-400",
    description: "Payment has been refunded to original sender",
  },
  Disputed: {
    label: "Disputed",
    colorClass: "bg-red-500/20 text-red-400",
    icon: "⚠",
    description: "Invoice is under dispute and requires resolution",
  },
  Frozen: {
    label: "Frozen",
    colorClass: "bg-indigo-500/20 text-indigo-400",
    icon: "🔒",
    description: "Invoice is frozen and cannot be modified or released",
  },
  Archived: {
    label: "Archived",
    colorClass: "bg-stone-500/20 text-stone-400",
    description: "Invoice has been archived and is no longer active",
  },
  Expired: {
    label: "Expired",
    colorClass: "bg-orange-500/20 text-orange-400",
    description: "Invoice has expired and can no longer be paid or modified",
  },
};

/**
 * Allowed status transitions for the invoice state machine.
 * A transition is only valid if the target status is listed for the
 * current status.
 */
export const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  Pending: ["Active", "Expired", "Archived"],
  Active: ["Funded", "Expired", "Archived"],
  Funded: ["Released", "Refunded", "Disputed", "Frozen"],
  Released: ["Archived"],
  Refunded: ["Archived"],
  Disputed: ["Funded", "Released", "Refunded", "Frozen", "Archived"],
  Frozen: ["Funded", "Disputed", "Archived"],
  Archived: [],
  Expired: ["Archived"],
};

export interface ReleaseCheckResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * Returns true if the transition from `from` to `to` is permitted by the
 * invoice state machine.
 */
export function canTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Determines whether an invoice's funds may be released.
 *
 * Release is blocked when:
 *  - the invoice has an unresolved dispute,
 *  - the invoice is frozen, archived or expired,
 *  - any milestone condition has not been satisfied.
 */
export function canReleaseInvoice(invoiceId: string): boolean {
  return getReleaseCheck(invoiceId).allowed;
}

/**
 * Detailed release check that reports every reason release is blocked.
 */
export function getReleaseCheck(invoiceId: string): ReleaseCheckResult {
  const reasons: string[] = [];

  const dispute = getActiveDispute(invoiceId);
  if (dispute) {
    reasons.push("Invoice has an unresolved dispute");
  }

  const milestones = getInvoiceMilestones(invoiceId);
  if (milestones.length > 0 && !areMilestoneConditionsSatisfied(invoiceId)) {
    reasons.push("Milestone conditions have not been satisfied");
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Convenience helper used by the release flow to short-circuit release
 * attempts. Equivalent to `!canReleaseInvoice(invoiceId)`.
 */
export function isReleaseBlocked(invoiceId: string): boolean {
  return !canReleaseInvoice(invoiceId);
}

/**
 * Validates and applies a transition to the Disputed status.
 * Throws if the transition is not permitted by the state machine.
 */
export function transitionToDisputed(
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (!canTransition(currentStatus, "Disputed")) {
    throw new Error(
      `Invalid status transition: ${currentStatus} -> Disputed`,
    );
  }
  return "Disputed";
}

/**
 * Validates and applies a transition to the Released status.
 * Enforces dispute resolution and milestone conditions before release.
 * Throws if the transition is not permitted or release is blocked.
 */
export function transitionToReleased(
  invoiceId: string,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (!canTransition(currentStatus, "Released")) {
    throw new Error(
      `Invalid status transition: ${currentStatus} -> Released`,
    );
  }

  const check = getReleaseCheck(invoiceId);
  if (!check.allowed) {
    throw new Error(
      `Release blocked for invoice ${invoiceId}: ${check.reasons.join("; ")}`,
    );
  }

  return "Released";
}
