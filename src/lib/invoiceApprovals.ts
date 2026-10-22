export type ApprovalRequestKind = "creation" | "modification";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "completed";
export type ApprovalDecision = "approved" | "rejected";

export interface ApprovalPolicy {
  enabled: boolean;
  minimumAmount: number;
  levels: string[][];
}

export interface ApprovalDraftPayload {
  recipients: { address: string; amount: string }[];
  token: string;
  deadline: number;
  recurring?: boolean;
  intervalDays?: number;
  splitMeta?: unknown;
  tags?: string[];
  cloneSourceId?: string;
}

export interface ApprovalDecisionRecord {
  approver: string;
  decision: ApprovalDecision;
  decidedAt: number;
  comment?: string;
}

export interface ApprovalStep {
  approvers: string[];
  decisions: ApprovalDecisionRecord[];
}

export interface ApprovalEvent {
  id: string;
  actor: string;
  action: "submitted" | "approved" | "rejected" | "completed";
  timestamp: number;
  comment?: string;
}

export interface InvoiceApprovalRequest {
  id: string;
  owner: string;
  kind: ApprovalRequestKind;
  invoiceId?: string;
  title: string;
  amount: number;
  payload?: ApprovalDraftPayload;
  changeSummary?: string;
  status: ApprovalRequestStatus;
  currentLevel: number;
  levels: ApprovalStep[];
  events: ApprovalEvent[];
  createdAt: number;
  updatedAt: number;
  txHash?: string;
}

export interface ApprovalAnalytics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  averageDecisionHours: number;
  approvalRate: number;
}

const POLICY_STORAGE_KEY = "stellarsplit_invoice_approval_policies_v1";
const REQUEST_STORAGE_KEY = "stellarsplit_invoice_approval_requests_v1";

function eventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getApprovalPolicy(owner: string): ApprovalPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const policies = JSON.parse(localStorage.getItem(POLICY_STORAGE_KEY) ?? "{}");
    return policies[owner] ?? null;
  } catch {
    return null;
  }
}

export function saveApprovalPolicy(owner: string, policy: ApprovalPolicy): void {
  if (typeof window === "undefined") return;
  const policies = (() => {
    try {
      return JSON.parse(localStorage.getItem(POLICY_STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  })();
  policies[owner] = policy;
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policies));
}

export function getApprovalRequests(): InvoiceApprovalRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const requests = JSON.parse(localStorage.getItem(REQUEST_STORAGE_KEY) ?? "[]");
    return Array.isArray(requests) ? requests : [];
  } catch {
    return [];
  }
}

export function saveApprovalRequests(requests: InvoiceApprovalRequest[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent("invoice-approvals-updated"));
}

export function notifyApprovalUsers(
  request: InvoiceApprovalRequest,
  users: string[],
  message: string,
): void {
  if (typeof window === "undefined" || users.length === 0) return;
  const key = "stellarsplit_notifications_v2";
  let notifications: Record<string, unknown>[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (Array.isArray(stored)) notifications = stored;
  } catch {
    notifications = [];
  }
  const additions = [...new Set(users)].map((user) => ({
    id: `approval-${request.id}-${user}-${request.updatedAt}`,
    type: "approval",
    invoiceId: request.invoiceId ?? request.id,
    approvalRequestId: request.id,
    invoiceTitle: request.title,
    message,
    timestamp: request.updatedAt,
    read: false,
  }));
  const existingIds = new Set(notifications.map((item) => item.id));
  localStorage.setItem(
    key,
    JSON.stringify([...additions.filter((item) => !existingIds.has(item.id)), ...notifications].slice(0, 50)),
  );
  window.dispatchEvent(new CustomEvent("approval-notifications-updated"));
}

export function shouldRequireApproval(amount: number, policy: ApprovalPolicy | null): boolean {
  return Boolean(
    policy?.enabled &&
      policy.levels.some((level) => level.length > 0) &&
      Number.isFinite(amount) &&
      amount >= policy.minimumAmount,
  );
}

export function createApprovalRequest(
  input: {
    owner: string;
    title: string;
    amount: number;
    payload: ApprovalDraftPayload;
    kind?: ApprovalRequestKind;
    invoiceId?: string;
    changeSummary?: string;
  },
  policy: ApprovalPolicy,
  now = Date.now(),
): InvoiceApprovalRequest {
  const id = eventId();
  return {
    id,
    owner: input.owner,
    kind: input.kind ?? "creation",
    invoiceId: input.invoiceId,
    title: input.title,
    amount: input.amount,
    payload: input.payload,
    changeSummary: input.changeSummary,
    status: "pending",
    currentLevel: 0,
    levels: policy.levels
      .filter((approvers) => approvers.length > 0)
      .map((approvers) => ({ approvers: [...new Set(approvers)], decisions: [] })),
    events: [{ id, actor: input.owner, action: "submitted", timestamp: now }],
    createdAt: now,
    updatedAt: now,
  };
}

export function recordApprovalDecision(
  request: InvoiceApprovalRequest,
  actor: string,
  decision: ApprovalDecision,
  comment = "",
  now = Date.now(),
): InvoiceApprovalRequest {
  if (request.status !== "pending") throw new Error("This request is no longer pending");
  if (request.owner === actor) throw new Error("Request owners cannot approve their own requests");
  const currentLevel = request.levels[request.currentLevel];
  if (!currentLevel || !currentLevel.approvers.includes(actor)) {
    throw new Error("You are not assigned to the current approval level");
  }
  if (currentLevel.decisions.some((item) => item.approver === actor)) {
    throw new Error("You have already responded to this approval level");
  }

  const decisionRecord: ApprovalDecisionRecord = {
    approver: actor,
    decision,
    decidedAt: now,
    ...(comment.trim() ? { comment: comment.trim() } : {}),
  };
  const levels = request.levels.map((level, index) =>
    index === request.currentLevel
      ? { ...level, decisions: [...level.decisions, decisionRecord] }
      : level,
  );
  const events = [
    ...request.events,
    {
      id: eventId(),
      actor,
      action: decision,
      timestamp: now,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    },
  ];

  if (decision === "rejected") {
    return { ...request, levels, events, status: "rejected", updatedAt: now };
  }

  const levelComplete = levels[request.currentLevel].approvers.every((approver) =>
    levels[request.currentLevel].decisions.some(
      (item) => item.approver === approver && item.decision === "approved",
    ),
  );
  const nextLevel = levelComplete ? request.currentLevel + 1 : request.currentLevel;
  return {
    ...request,
    levels,
    events,
    currentLevel: nextLevel,
    status: nextLevel >= levels.length ? "approved" : "pending",
    updatedAt: now,
  };
}

export function completeApprovalRequest(
  request: InvoiceApprovalRequest,
  actor: string,
  invoiceId: string,
  txHash: string,
  now = Date.now(),
): InvoiceApprovalRequest {
  if (request.status !== "approved") throw new Error("All approval levels must pass first");
  if (request.owner !== actor) throw new Error("Only the request owner can create this invoice");
  return {
    ...request,
    invoiceId,
    txHash,
    status: "completed",
    updatedAt: now,
    events: [...request.events, { id: eventId(), actor, action: "completed", timestamp: now }],
  };
}

export function summarizeApprovalAnalytics(
  requests: InvoiceApprovalRequest[],
): ApprovalAnalytics {
  const decided = requests.filter((request) => request.status !== "pending");
  const decisionDurations = requests
    .filter((request) => request.status !== "pending")
    .map((request) => {
      const finalDecision = [...request.events]
        .reverse()
        .find((event) => event.action === "approved" || event.action === "rejected");
      return finalDecision ? finalDecision.timestamp - request.createdAt : null;
    })
    .filter((duration): duration is number => duration !== null);
  const approved = requests.filter(
    (request) => request.status === "approved" || request.status === "completed",
  ).length;
  return {
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    approved,
    rejected: requests.filter((request) => request.status === "rejected").length,
    completed: requests.filter((request) => request.status === "completed").length,
    averageDecisionHours:
      decisionDurations.length === 0
        ? 0
        : decisionDurations.reduce((sum, duration) => sum + duration, 0) /
          decisionDurations.length /
          3_600_000,
    approvalRate: decided.length === 0 ? 0 : (approved / decided.length) * 100,
  };
}