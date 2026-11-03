export interface ApprovalPolicy {
  enabled: boolean;
  minimumAmount: number;
  levels: string[][];
}

export interface InvoiceApprovalRequest {
  id: string;
  invoiceId: string;
  status: "pending" | "approved" | "rejected";
  amount?: number;
  createdAt?: number;
  updatedAt?: number;
  owner?: string;
  currentLevel?: number;
  levels?: Array<{ approvers: string[]; decisions?: Array<{ approver: string; decision: string }> }>;
  address?: string;
  [key: string]: any;
}

export async function getApprovalRequests(): Promise<InvoiceApprovalRequest[]> {
  return [];
}

export async function saveApprovalRequests(requests: InvoiceApprovalRequest[]): Promise<void> {}

export async function getApprovalPolicy(): Promise<ApprovalPolicy> {
  return { enabled: false, minimumAmount: 0, levels: [] };
}

export async function saveApprovalPolicy(walletOrPolicy: string | ApprovalPolicy, policy?: ApprovalPolicy): Promise<void> {}

export async function notifyApprovalUsers(request: InvoiceApprovalRequest, users?: string[], message?: string): Promise<void> {}

export function recordApprovalDecision(request: InvoiceApprovalRequest, wallet: string, decision: string, comment?: string): InvoiceApprovalRequest {
  return { ...request, status: decision as any };
}

export async function summarizeApprovalAnalytics(requests?: InvoiceApprovalRequest[]): Promise<any> {
  return {};
}

export function completeApprovalRequest(request: InvoiceApprovalRequest, wallet: any, invoiceId: string, txHash: string): InvoiceApprovalRequest {
  return { ...request, status: "approved" };
}

export function shouldRequireApproval(amount: number, policy: ApprovalPolicy): boolean {
  return policy.enabled && amount >= policy.minimumAmount;
}

export function createApprovalRequest(invoiceId: string, amount: number): InvoiceApprovalRequest {
  return {
    id: Math.random().toString(),
    invoiceId,
    status: "pending",
    amount,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    levels: [],
  };
}
