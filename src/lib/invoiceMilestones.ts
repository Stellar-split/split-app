export const MILESTONE_PERCENTS = [25, 50, 75, 100] as const;

export interface InvoiceMilestone {
  percent: number;
  label: string;
  reached: boolean;
}

export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (raised / target) * 100));
}

export function milestonesFor(raised: number, target: number): InvoiceMilestone[] {
  const pct = fundedPercent(raised, target);
  return MILESTONE_PERCENTS.map((percent) => ({
    percent,
    label: percent === 100 ? "Fully funded" : `${percent}% funded`,
    reached: pct >= percent,
  }));
}

export function newestMilestone(raised: number, target: number): InvoiceMilestone | null {
  const reached = milestonesFor(raised, target).filter((m) => m.reached);
  return reached.length ? reached[reached.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Conditional milestone releases
// ---------------------------------------------------------------------------

export type ConditionType = "deliverable" | "approval" | "evidence";

export type ConditionStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "verified"
  | "rejected";

export interface ApprovalRecord {
  id: string;
  approver: string;
  approved: boolean;
  note?: string;
  timestamp: number;
}

export interface EvidenceRecord {
  id: string;
  fileName: string;
  mimeType?: string;
  url?: string;
  uploadedBy: string;
  timestamp: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: number;
}

export interface MilestoneCondition {
  id: string;
  type: ConditionType;
  description: string;
  status: ConditionStatus;
  required: boolean;
  approvals: ApprovalRecord[];
  evidence: EvidenceRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface MilestoneState {
  id: string;
  percent: number;
  label: string;
  conditions: MilestoneCondition[];
  released: boolean;
  releasedAt?: number;
}

export interface ConditionValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ReleaseGateResult {
  canRelease: boolean;
  reasons: string[];
  unmetConditions: MilestoneCondition[];
}

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Pure validation functions
// ---------------------------------------------------------------------------

export function validateCondition(condition: MilestoneCondition): ConditionValidationResult {
  const errors: string[] = [];

  if (!condition.id) errors.push("Condition id is required");
  if (!condition.description || !condition.description.trim()) {
    errors.push("Condition description is required");
  }
  if (condition.type !== "deliverable" && condition.type !== "approval" && condition.type !== "evidence") {
    errors.push(`Unknown condition type: ${String(condition.type)}`);
  }

  if (condition.type === "approval") {
    if (condition.status === "approved" || condition.status === "verified") {
      const hasApproval = condition.approvals.some((a) => a.approved);
      if (!hasApproval) {
        errors.push("Approval condition requires at least one approving record");
      }
    }
  }

  if (condition.type === "evidence") {
    if (condition.status === "verified") {
      const hasVerifiedEvidence = condition.evidence.some((e) => e.verified);
      if (!hasVerifiedEvidence) {
        errors.push("Evidence condition requires at least one verified evidence record");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isConditionSatisfied(condition: MilestoneCondition): boolean {
  if (!condition.required) return true;

  switch (condition.type) {
    case "deliverable":
      return condition.status === "verified" || condition.status === "approved";
    case "approval":
      return (
        (condition.status === "approved" || condition.status === "verified") &&
        condition.approvals.some((a) => a.approved)
      );
    case "evidence":
      return (
        (condition.status === "verified" || condition.status === "approved") &&
        condition.evidence.some((e) => e.verified)
      );
    default:
      return false;
  }
}

export function evaluateReleaseGate(milestone: MilestoneState): ReleaseGateResult {
  const unmetConditions = milestone.conditions.filter((c) => !isConditionSatisfied(c));
  const reasons: string[] = [];

  if (milestone.released) {
    reasons.push("Milestone has already been released");
  }

  for (const condition of unmetConditions) {
    reasons.push(`Condition not satisfied: ${condition.description} (${condition.type})`);
  }

  return {
    canRelease: reasons.length === 0,
    reasons,
    unmetConditions,
  };
}

export function canReleaseMilestone(milestone: MilestoneState): boolean {
  return evaluateReleaseGate(milestone).canRelease;
}

// ---------------------------------------------------------------------------
// Persistence helpers (localStorage-backed)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "invoiceMilestones.v1";

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // Access to localStorage may throw in restricted environments.
  }
  return null;
}

function readAll(): Record<string, MilestoneState[]> {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, MilestoneState[]>;
    return {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, MilestoneState[]>): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / serialization errors.
  }
}

export function getMilestones(invoiceId: string): MilestoneState[] {
  const all = readAll();
  return all[invoiceId] ? all[invoiceId].map((m) => ({ ...m })) : [];
}

export function saveMilestones(invoiceId: string, milestones: MilestoneState[]): void {
  const all = readAll();
  all[invoiceId] = milestones;
  writeAll(all);
}

function updateMilestone(
  invoiceId: string,
  milestoneId: string,
  updater: (milestone: MilestoneState) => MilestoneState,
): MilestoneState | null {
  const milestones = getMilestones(invoiceId);
  const index = milestones.findIndex((m) => m.id === milestoneId);
  if (index === -1) return null;
  const updated = updater(milestones[index]);
  milestones[index] = updated;
  saveMilestones(invoiceId, milestones);
  return updated;
}

function updateCondition(
  invoiceId: string,
  milestoneId: string,
  conditionId: string,
  updater: (condition: MilestoneCondition) => MilestoneCondition,
): MilestoneCondition | null {
  let result: MilestoneCondition | null = null;
  updateMilestone(invoiceId, milestoneId, (milestone) => {
    const conditions = milestone.conditions.map((c) => {
      if (c.id !== conditionId) return c;
      const next = updater(c);
      result = next;
      return next;
    });
    return { ...milestone, conditions };
  });
  return result;
}

export function createMilestone(
  invoiceId: string,
  percent: number,
  label?: string,
): MilestoneState {
  const milestone: MilestoneState = {
    id: generateId("ms"),
    percent,
    label: label ?? (percent === 100 ? "Fully funded" : `${percent}% funded`),
    conditions: [],
    released: false,
  };
  const existing = getMilestones(invoiceId);
  existing.push(milestone);
  saveMilestones(invoiceId, existing);
  return milestone;
}

export function addCondition(
  invoiceId: string,
  milestoneId: string,
  input: {
    type: ConditionType;
    description: string;
    required?: boolean;
  },
): MilestoneCondition | null {
  const condition: MilestoneCondition = {
    id: generateId("cond"),
    type: input.type,
    description: input.description,
    status: "pending",
    required: input.required ?? true,
    approvals: [],
    evidence: [],
    createdAt: now(),
    updatedAt: now(),
  };

  const updated = updateMilestone(invoiceId, milestoneId, (milestone) => ({
    ...milestone,
    conditions: [...milestone.conditions, condition],
  }));

  return updated ? condition : null;
}

export function submitEvidence(
  invoiceId: string,
  milestoneId: string,
  conditionId: string,
  input: {
    fileName: string;
    mimeType?: string;
    url?: string;
    uploadedBy: string;
  },
): EvidenceRecord | null {
  const evidence: EvidenceRecord = {
    id: generateId("ev"),
    fileName: input.fileName,
    mimeType: input.mimeType,
    url: input.url,
    uploadedBy: input.uploadedBy,
    timestamp: now(),
    verified: false,
  };

  const updated = updateCondition(invoiceId, milestoneId, conditionId, (condition) => ({
    ...condition,
    evidence: [...condition.evidence, evidence],
    status: condition.status === "pending" ? "submitted" : condition.status,
    updatedAt: now(),
  }));

  return updated ? evidence : null;
}

export function verifyEvidence(
  invoiceId: string,
  milestoneId: string,
  conditionId: string,
  evidenceId: string,
  verifiedBy: string,
): EvidenceRecord | null {
  let result: EvidenceRecord | null = null;

  updateCondition(invoiceId, milestoneId, conditionId, (condition) => {
    const evidence = condition.evidence.map((e) => {
      if (e.id !== evidenceId) return e;
      const next: EvidenceRecord = {
        ...e,
        verified: true,
        verifiedBy,
        verifiedAt: now(),
      };
      result = next;
      return next;
    });
    return { ...condition, evidence, updatedAt: now() };
  });

  return result;
}

export function approveCondition(
  invoiceId: string,
  milestoneId: string,
  conditionId: string,
  input: {
    approver: string;
    approved: boolean;
    note?: string;
  },
): ApprovalRecord | null {
  const approval: ApprovalRecord = {
    id: generateId("appr"),
    approver: input.approver,
    approved: input.approved,
    note: input.note,
    timestamp: now(),
  };

  const updated = updateCondition(invoiceId, milestoneId, conditionId, (condition) => {
    const approvals = [...condition.approvals, approval];
    let status: ConditionStatus = condition.status;
    if (input.approved) {
      status = "approved";
    } else {
      status = "rejected";
    }
    return { ...condition, approvals, status, updatedAt: now() };
  });

  return updated ? approval : null;
}

export function verifyCondition(
  invoiceId: string,
  milestoneId: string,
  conditionId: string,
): MilestoneCondition | null {
  return updateCondition(invoiceId, milestoneId, conditionId, (condition) => {
    const validation = validateCondition({ ...condition, status: "verified" });
    if (!validation.valid) {
      return condition;
    }
    return { ...condition, status: "verified", updatedAt: now() };
  });
}

// ---------------------------------------------------------------------------
// Release gate
// ---------------------------------------------------------------------------

export class MilestoneReleaseError extends Error {
  readonly reasons: string[];
  readonly unmetConditions: MilestoneCondition[];

  constructor(reasons: string[], unmetConditions: MilestoneCondition[]) {
    super(`Cannot release milestone: ${reasons.join("; ")}`);
    this.name = "MilestoneReleaseError";
    this.reasons = reasons;
    this.unmetConditions = unmetConditions;
  }
}

export function releaseMilestone(
  invoiceId: string,
  milestoneId: string,
): MilestoneState {
  const milestones = getMilestones(invoiceId);
  const milestone = milestones.find((m) => m.id === milestoneId);

  if (!milestone) {
    throw new MilestoneReleaseError(["Milestone not found"], []);
  }

  const gate = evaluateReleaseGate(milestone);
  if (!gate.canRelease) {
    throw new MilestoneReleaseError(gate.reasons, gate.unmetConditions);
  }

  const updated = updateMilestone(invoiceId, milestoneId, (m) => ({
    ...m,
    released: true,
    releasedAt: now(),
  }));

  if (!updated) {
    throw new MilestoneReleaseError(["Milestone not found"], []);
  }

  return updated;
}