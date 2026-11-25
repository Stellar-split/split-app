import { getMilestones } from "./invoiceMilestones";
import { getDisputesByInvoice } from "./arbitrators";

export const STATUS_CONFIG: Record<string, { color: string; label: string; icon?: string }> = {
  Pending: { color: 'blue', label: 'Pending' },
  Funded: { color: 'green', label: 'Funded' },
  Released: { color: 'green', label: 'Released' },
  Refunded: { color: 'red', label: 'Refunded' },
  Cancelled: { color: 'gray', label: 'Cancelled' },
  Disputed: { color: 'yellow', label: 'Disputed' },
  Archived: { color: 'gray', label: 'Archived' },
};

export type InvoiceStatus =
  | "Pending"
  | "Funded"
  | "Disputed"
  | "Released"
  | "Refunded"
  | "Cancelled"
  | "Archived";

/**
 * Allowed invoice status transitions. Terminal states map to empty arrays.
 */
export const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  Pending: ["Funded", "Cancelled", "Archived"],
  Funded: ["Disputed", "Released", "Refunded", "Archived"],
  Disputed: ["Released", "Refunded", "Archived"],
  Released: ["Archived"],
  Refunded: ["Archived"],
  Cancelled: ["Archived"],
  Archived: [],
};

export interface ReleaseCheck {
  allowed: boolean;
  reasons: string[];
}

/**
 * Returns whether a status transition is permitted by STATUS_TRANSITIONS.
 */
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Collects the reasons that block releasing an invoice.
 */
export function getReleaseCheck(invoiceId: string): ReleaseCheck {
  const reasons: string[] = [];

  const milestones = getMilestones(invoiceId);
  const hasUnmetConditions = milestones.some(
    (milestone) =>
      !milestone.released &&
      milestone.conditions.some((condition) => {
        if (!condition.required) return false;
        if (condition.type === "deliverable") {
          return condition.status !== "verified" && condition.status !== "approved";
        }
        if (condition.type === "approval") {
          return !(
            (condition.status === "approved" || condition.status === "verified") &&
            condition.approvals.some((a) => a.approved)
          );
        }
        if (condition.type === "evidence") {
          return !(
            (condition.status === "verified" || condition.status === "approved") &&
            condition.evidence.some((e) => e.verified)
          );
        }
        return true;
      }),
  );
  if (hasUnmetConditions) {
    reasons.push("Milestone conditions have not been satisfied");
  }

  const hasActiveDispute = getDisputesByInvoice(invoiceId).some(
    (dispute) => dispute.state !== "Resolved" && dispute.state !== "Enforced",
  );
  if (hasActiveDispute) {
    reasons.push("Invoice has an unresolved dispute");
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Returns true when the invoice can be released.
 */
export function canReleaseInvoice(invoiceId: string): boolean {
  return getReleaseCheck(invoiceId).allowed;
}

/**
 * Returns true when release is blocked for the invoice.
 */
export function isReleaseBlocked(invoiceId: string): boolean {
  return !canReleaseInvoice(invoiceId);
}

/**
 * Returns the Disputed status when the transition is valid, otherwise throws.
 */
export function transitionToDisputed(from: InvoiceStatus): InvoiceStatus {
  if (!canTransition(from, "Disputed")) {
    throw new Error(`Invalid status transition: ${from} -> Disputed`);
  }
  return "Disputed";
}

/**
 * Returns the Released status when the transition is valid and release is
 * unblocked, otherwise throws.
 */
export function transitionToReleased(
  invoiceId: string,
  from: InvoiceStatus,
): InvoiceStatus {
  if (!canTransition(from, "Released")) {
    throw new Error(`Invalid status transition: ${from} -> Released`);
  }
  const check = getReleaseCheck(invoiceId);
  if (!check.allowed) {
    throw new Error(`Release blocked: ${check.reasons.join("; ")}`);
  }
  return "Released";
}

export function checkReleaseBlock(invoice: any): string | null {
  const invoiceId = invoice?.id ?? invoice?.invoiceId;
  if (!invoiceId) return null;
  const check = getReleaseCheck(invoiceId);
  return check.allowed ? null : check.reasons.join("; ");
}
