export interface ApprovalPolicy {
  enabled: boolean;
  minimumAmount: number;
  levels: string[][];
}

export type InvoiceApprovalRequest = ApprovalRequest;

const APPROVAL_REQUESTS_KEY = "stellarsplit_approval_requests";
const APPROVAL_POLICY_KEY = "stellarsplit_approval_policy";

const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  enabled: false,
  minimumAmount: 0,
  levels: [],
};

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // Access to localStorage may throw in restricted environments.
  }
  return null;
}

/** Reads the configured invoice approval policy, falling back to a disabled default. */
export async function getApprovalPolicy(): Promise<ApprovalPolicy> {
  const storage = getStorage();
  if (!storage) return DEFAULT_APPROVAL_POLICY;
  try {
    const raw = storage.getItem(APPROVAL_POLICY_KEY);
    return raw ? { ...DEFAULT_APPROVAL_POLICY, ...JSON.parse(raw) } : DEFAULT_APPROVAL_POLICY;
  } catch {
    return DEFAULT_APPROVAL_POLICY;
  }
}

/** Reads all persisted approval requests, most recently created first. */
export async function getApprovalRequests(): Promise<ApprovalRequest[]> {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(APPROVAL_REQUESTS_KEY);
    return raw ? (JSON.parse(raw) as ApprovalRequest[]) : [];
  } catch {
    return [];
  }
}

/** Persists the full list of approval requests. */
export function saveApprovalRequests(requests: ApprovalRequest[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(APPROVAL_REQUESTS_KEY, JSON.stringify(requests));
  } catch {
    // Storage may be full or unavailable; the request is still returned to the caller.
  }
}

export interface ApprovalRequest {
  id: string;
  invoiceId: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  owner: string;
  title: string;
  payload: { recipients: unknown[]; token: string; deadline: number };
  currentLevel: number;
  levels: Array<{
    approvers: string[];
    decisions: Array<{ approver: string; decision: string; comment?: string; timestamp: number }>;
  }>;
  events: Array<{ approver: string; decision: string; comment?: string; timestamp: number; level: number }>;
  createdAt: number;
  updatedAt: number;
}

export function shouldRequireApproval(amount: number, policy: ApprovalPolicy): boolean {
  return policy.enabled && amount >= policy.minimumAmount;
}

export function createApprovalRequest(
  invoiceData: {
    owner: string;
    title: string;
    amount: number;
    payload: { recipients: unknown[]; token: string; deadline: number };
  },
  policy: ApprovalPolicy,
  timestamp: number,
): ApprovalRequest {
  return {
    id: Math.random().toString(36).slice(2),
    invoiceId: Math.random().toString(36).slice(2),
    status: "pending",
    amount: invoiceData.amount,
    owner: invoiceData.owner,
    title: invoiceData.title,
    payload: invoiceData.payload,
    currentLevel: 0,
    levels: policy.levels.map((approvers) => ({ approvers, decisions: [] })),
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function recordApprovalDecision(
  request: ApprovalRequest,
  wallet: string,
  decision: "approved" | "rejected",
  comment?: string,
  timestamp?: number,
): ApprovalRequest {
  if (wallet === request.owner) {
    throw new Error("cannot approve their own");
  }

  if (request.status !== "pending") {
    throw new Error("request is not pending");
  }

  const ts = timestamp ?? Date.now();
  const level = request.currentLevel;
  const currentLevelData = request.levels[level];

  if (!currentLevelData || !currentLevelData.approvers.includes(wallet)) {
    throw new Error("not assigned");
  }

  const newDecision = { approver: wallet, decision, comment, timestamp: ts };
  const newEvent = { approver: wallet, decision, comment, timestamp: ts, level };

  const alreadyDecided = currentLevelData.decisions.some((d) => d.approver === wallet);
  if (alreadyDecided) {
    throw new Error("already decided");
  }

  const updatedLevels = request.levels.map((l, i) => {
    if (i !== level) return l;
    return { ...l, decisions: [...l.decisions, newDecision] };
  });

  const updatedEvents = [...request.events, newEvent];

  if (decision === "rejected") {
    return {
      ...request,
      status: "rejected",
      levels: updatedLevels,
      events: updatedEvents,
      updatedAt: ts,
    };
  }

  // All approvers at this level have decided
  const updatedCurrentLevel = updatedLevels[level];
  const allApproved =
    updatedCurrentLevel.approvers.every((a) =>
      updatedCurrentLevel.decisions.some((d) => d.approver === a && d.decision === "approved"),
    );

  if (!allApproved) {
    return {
      ...request,
      levels: updatedLevels,
      events: updatedEvents,
      updatedAt: ts,
    };
  }

  const nextLevel = level + 1;
  if (nextLevel >= request.levels.length) {
    return {
      ...request,
      status: "approved",
      currentLevel: nextLevel,
      levels: updatedLevels,
      events: updatedEvents,
      updatedAt: ts,
    };
  }

  return {
    ...request,
    currentLevel: nextLevel,
    levels: updatedLevels,
    events: updatedEvents,
    updatedAt: ts,
  };
}

export function summarizeApprovalAnalytics(requests: ApprovalRequest[]): {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageDecisionHours: number;
  approvalRate: number;
} {
  const total = requests.length;
  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

  const decided = requests.filter((r) => r.status !== "pending" && r.events.length > 0);
  const averageDecisionHours =
    decided.length === 0
      ? 0
      : decided.reduce((sum, r) => {
          const lastEvent = r.events[r.events.length - 1];
          return sum + (lastEvent.timestamp - r.createdAt) / 1000 / 3600;
        }, 0) / decided.length;

  const decidedCount = approved + rejected;
  const approvalRate = decidedCount === 0 ? 0 : approved / decidedCount;

  return { total, pending, approved, rejected, averageDecisionHours, approvalRate };
}
